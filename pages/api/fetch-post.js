import Snoowrap from 'snoowrap';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import sendPushNotification from '../utils/sendPushNotifications';

const r = new Snoowrap({
  userAgent: 'ddd',
  clientId: 'wwid93PKEjyWSGOZ_d7qoA',
  clientSecret: 'g7b4U3Ufw1JyLvSuarJtsvuqzPrZJw',
  refreshToken: '103191020185632-33fnsu5dr1uwZTzOEXqgZoXYMKZb-g',
});

const getPostDetailsFromFile = (postId) => {
  const filePath = path.resolve(`./data/reddit-deleted/${postId}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  }
  return null;
};

const savePostDetailsToFile = (postId, postDetails) => {
  const filePath = path.resolve(`./data/reddit-deleted/${postId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(postDetails, null, 2));
};

export default async function handler(req, res) {
  const { url } = req.body;

  try {
    const postIdMatch = url.match(/comments\/([a-z0-9]+)\//i);
    if (!postIdMatch || postIdMatch.length < 2) {
      throw new Error('Invalid post ID');
    }

    const postId = postIdMatch[1];
    const post = await r.getSubmission(postId).fetch();

    const isDeleted = post.author.name === '[deleted]' || post.removed_by_category !== null || post.removed;
    let deletedTime = null;

    const existingPostDetails = getPostDetailsFromFile(postId);
    const currentStatus = existingPostDetails ? existingPostDetails.is_deleted : null;

    if (isDeleted && !currentStatus) {
      // Post is deleted for the first time
      deletedTime = DateTime.now().toISO();
      await sendPushNotification('Post Deleted', `The post at ${url} has been deleted at ${deletedTime}.`);
    } else if (existingPostDetails && currentStatus) {
      // Post was already deleted
      deletedTime = existingPostDetails.deleted_time;
    }

    const postDetails = {
      post_id: post.id,
      title: post.title,
      author: post.author.name,
      created_utc: post.created_utc, 
      subreddit: post.subreddit_name_prefixed,
      is_deleted: isDeleted,
      deleted_time: deletedTime,
      numUpvotes: post.ups,
      numComments: post.num_comments,
      numXPosts: post.num_crossposts,
    };

    // Only update the file if the status has changed
    if (!existingPostDetails || existingPostDetails.is_deleted !== isDeleted) {
      savePostDetailsToFile(postId, postDetails);
    }

    res.status(200).json(postDetails);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch post', error: error.message });
  }
}
