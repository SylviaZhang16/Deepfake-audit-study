import Snoowrap from 'snoowrap';


const r = new Snoowrap({
    userAgent: 'ddd',   
    clientId: 'wwid93PKEjyWSGOZ_d7qoA',   
    clientSecret: 'g7b4U3Ufw1JyLvSuarJtsvuqzPrZJw',   
    refreshToken: '103191020185632-33fnsu5dr1uwZTzOEXqgZoXYMKZb-g',
});

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

    const postDetails = {
      post_id: post.id,
      title: post.title,
      author: post.author.name,
      created_utc: post.created_utc,
      subreddit: post.subreddit_name_prefixed,
      is_deleted: isDeleted,
    };

    res.status(200).json(postDetails);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch post', error: error.message });
  }
}