import Snoowrap from 'snoowrap';
import { DateTime } from 'luxon';
import fs from 'fs/promises';
import path from 'path';
// import sendPushNotification from '../utils/sendPushNotifications'; // Uncomment and update if needed

const r = new Snoowrap({
  userAgent: 'ddd',
  clientId: 'wwid93PKEjyWSGOZ_d7qoA',
  clientSecret: 'g7b4U3Ufw1JyLvSuarJtsvuqzPrZJw',
  refreshToken: '103191020185632-33fnsu5dr1uwZTzOEXqgZoXYMKZb-g',
});

const getPostDetailsFromFile = async (postId) => {
  const filePath = path.resolve(`./data/reddit-deleted/${postId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
};

const savePostDetailsToFile = async (postId, postDetails) => {
  const filePath = path.resolve(`./data/reddit-deleted/${postId}.json`);
  await fs.writeFile(filePath, JSON.stringify(postDetails, null, 2));
};

export const fetchPostDetails = async (url) => {
  try {
    const postIdMatch = url.match(/comments\/([a-z0-9]+)\//i);
    if (!postIdMatch || postIdMatch.length < 2) {
      throw new Error('Invalid post ID');
    }

    const postId = postIdMatch[1];
    const post = await r.getSubmission(postId).fetch();

    const isDeleted = post.author.name === '[deleted]' || post.removed_by_category !== null || post.removed;
    let deletedTime = null;

    const existingPostDetails = await getPostDetailsFromFile(postId);
    const currentStatus = existingPostDetails ? existingPostDetails.is_deleted : null;

    if (isDeleted && !currentStatus) {
      deletedTime = DateTime.now().toISO();
      // await sendPushNotification('Post Deleted', `The post at ${url} has been deleted at ${deletedTime}.`);
    } else if (existingPostDetails && currentStatus) {
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

    if (!existingPostDetails || existingPostDetails.is_deleted !== isDeleted) {
      await savePostDetailsToFile(postId, postDetails);
    }

    return postDetails;
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

export default async function handler(req, res) {
  const { url } = req.body;

  try {
    const postDetails = await fetchPostDetails(url);
    res.status(200).json(postDetails);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch post', error: error.message });
  }
}
