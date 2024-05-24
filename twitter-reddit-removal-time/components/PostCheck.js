import { useState } from 'react';

const PostChecker = () => {
  const [url, setUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(true);
  const [postStatus, setPostStatus] = useState('');

  const validateUrl = (url) => {
    const redditRegex = /^(https?:\/\/)?(www\.)?reddit\.com\/r\/[A-Za-z0-9_]+\/comments\/[A-Za-z0-9_]+\/?$/;
    const twitterRegex = /^(https?:\/\/)?(www\.)?twitter\.com\/[A-Za-z0-9_]+\/status\/[0-9]+\/?$/;
    return redditRegex.test(url) || twitterRegex.test(url);
  };

  const checkPostStatus = async (url) => {
    if (!validateUrl(url)) {
      setIsValidUrl(false);
      setPostStatus('');
      return;
    }

    setIsValidUrl(true);
    const isReddit = url.includes('reddit.com');
    const fetchUrl = isReddit ? `${url}.json` : url;

    try {
      const response = await fetch(fetchUrl);
      if (response.status === 404) {
        setPostStatus('Post has been taken down.');
      } else if (response.status === 200) {
        if (isReddit) {
          const data = await response.json();
          if (data.length === 0) {
            setPostStatus('Post has been taken down.');
          } else {
            setPostStatus('Post is available.');
          }
        } else {
          setPostStatus('Post is available.');
        }
      } else {
        setPostStatus('Error fetching post.');
      }
    } catch (error) {
      setPostStatus('Error fetching post.');
      console.error('Error fetching post:', error);
    }
  };

  const handleInputChange = (e) => {
    setUrl(e.target.value);
    setPostStatus('');
  };

  const handleCheckClick = () => {
    checkPostStatus(url);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter Reddit or Twitter post URL"
        value={url}
        onChange={handleInputChange}
        style={{ borderColor: isValidUrl ? 'black' : 'red' }}
      />
      <button onClick={handleCheckClick}>Check Post Status</button>
      <div>{postStatus}</div>
      {!isValidUrl && <div style={{ color: 'red' }}>Invalid URL. Please enter a valid Reddit or Twitter post URL.</div>}
    </div>
  );
};

export default PostChecker;
