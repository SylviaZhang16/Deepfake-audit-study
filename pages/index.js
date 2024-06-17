// pages/index.js
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [userGroups, setUserGroups] = useState([{ username: '', password: '', urls: [''] }]);
  const [logs, setLogs] = useState({});
  const [isValidUrls, setIsValidUrls] = useState([true]);
  const [postDetails, setPostDetails] = useState({});
  const [error, setError] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadUsername, setDownloadUsername] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [countdown, setCountdown] = useState(0); // Countdown state
  const [interval, setIntervalTime] = useState(3600); // Interval for fetching in seconds (1 hour default)

  const intervalRefs = useRef({});
  const countdownIntervalRef = useRef(null);

  const validateUrl = (url) => url.includes('.com');

  const checkPostStatus = async (url, index) => {
    if (!validateUrl(url)) {
      setIsValidUrls((prev) => {
        const newIsValidUrls = [...prev];
        newIsValidUrls[index] = false;
        return newIsValidUrls;
      });
      setPostDetails((prev) => {
        const newPostDetails = { ...prev };
        delete newPostDetails[url];
        return newPostDetails;
      });
      return false;
    }

    setIsValidUrls((prev) => {
      const newIsValidUrls = [...prev];
      newIsValidUrls[index] = true;
      return newIsValidUrls;
    });

    try {
      const response = await fetch('/api/fetch-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.status === 'error') {
        setPostDetails((prev) => {
          const newPostDetails = { ...prev };
          delete newPostDetails[url];
          return newPostDetails;
        });
        setError((prev) => ({ ...prev, [url]: data.message }));
        return false;
      } else {
        setPostDetails((prev) => ({ ...prev, [url]: data }));
        setError((prev) => ({ ...prev, [url]: '' }));
        return !data.is_deleted;
      }
    } catch (error) {
      console.error('Error checking post status:', error);
      setPostDetails((prev) => {
        const newPostDetails = { ...prev };
        delete newPostDetails[url];
        return newPostDetails;
      });
      setError((prev) => ({ ...prev, [url]: 'Failed to check post status' }));
      return false;
    }
  };

  const startMonitoring = (url, index) => {
    if (intervalRefs.current[url]) {
      clearInterval(intervalRefs.current[url]);
    }

    intervalRefs.current[url] = setInterval(async () => {
      const isPostAvailable = await checkPostStatus(url, index);
      if (!isPostAvailable) {
        setLogs((prev) => ({
          ...prev,
          [url]: (prev[url] || '') + 'The post has been deleted or removed by a moderator.\n',
        }));
        clearInterval(intervalRefs.current[url]);
      }
    }, 10000);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    userGroups.forEach((group, groupIndex) => {
      fetchMetrics(group.username, group.password);

      group.urls.forEach((url, index) => {
        const isPostAvailable = checkPostStatus(url, index);
        if (!isPostAvailable) {
          alert(`The post at ${url} is either invalid or has been taken down.`);
          return;
        }

        startMonitoring(url, index);
      });
    });
  };

  const fetchMetrics = async (username, password) => {
    try {
      const response = await fetch('/api/reddit-login-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ username, password }]),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setMetrics([]);
      } else {
        setMetrics(data.metrics || []);
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setError('Failed to fetch metrics');
      setMetrics([]);
    }
  };

  const handleGroupChange = (index, field, value) => {
    setUserGroups((prev) => {
      const newGroups = [...prev];
      newGroups[index][field] = value;
      return newGroups;
    });
  };

  const handleUrlChange = (groupIndex, urlIndex, value) => {
    setUserGroups((prev) => {
      const newGroups = [...prev];
      newGroups[groupIndex].urls[urlIndex] = value;
      return newGroups;
    });
  };

  const addUrlField = (groupIndex) => {
    setUserGroups((prev) => {
      const newGroups = [...prev];
      newGroups[groupIndex].urls.push('');
      return newGroups;
    });
  };

  const addUserGroup = () => {
    setUserGroups((prev) => [...prev, { username: '', password: '', urls: [''] }]);
    setIsValidUrls((prev) => [...prev, true]);
  };

  const handleFetchLatestMetrics = async () => {
    try {
      const allMetrics = await Promise.all(
        userGroups.map(async (group) => {
          const response = await fetch(`/api/fetch-latest-metrics?username=${group.username}`);
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
          if (data.error) {
            setError((prev) => ({ ...prev, [group.username]: data.error }));
            return null;
          } else {
            setError((prev) => ({ ...prev, [group.username]: null }));
            return data.metrics || [];
          }
        })
      );
  
      const combinedMetrics = allMetrics.flat().filter(Boolean);
      setMetrics(combinedMetrics);
      setCountdown(interval); // Reset countdown after fetching metrics
  
      // Send Pushover notification
      await fetch('/api/send-test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Metrics Fetched',
          message: 'The latest metrics have been fetched.',
        }),
      });
    } catch (error) {
      console.error('Error fetching latest metrics:', error);
      setError('Failed to fetch latest metrics');
      setMetrics([]);
    }
  };
  

  const handleDownload = async (username) => {
    try {
      const response = await fetch(`/api/download-file?username=${username}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${username}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Failed to download file');
    }
  };

  const handleDownloadAll = async () => {
    try {
      const response = await fetch(`/api/download-all-files`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'all_files.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Error downloading all files:', error);
      setError('Failed to download all files');
    }
  };

  const handleDownloadBackupFiles = async () => {
    try {
      const response = await fetch('/api/download-backup-files');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reddit-deleted.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Error downloading files:', error);
      setError('Failed to download files');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        // Ensure each group has a 'urls' array
        json.forEach(group => {
          if (!group.urls) {
            group.urls = [];
          }
        });
        setUserGroups(json);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        setError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const removeUrlField = (groupIndex, urlIndex) => {
    setUserGroups((prev) => {
      const newGroups = [...prev];
      newGroups[groupIndex].urls.splice(urlIndex, 1);
      return newGroups;
    });
  };

  const removeUserGroup = (groupIndex) => {
    setUserGroups((prev) => {
      const newGroups = [...prev];
      newGroups.splice(groupIndex, 1);
      return newGroups;
    });
  };

  const [screenshotUrl, setScreenshotUrl] = useState('');

  const handleShowScreenshot = async () => {
    const response = await fetch('/api/screenshot');
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setScreenshotUrl(url);
    } else {
      console.error('Failed to fetch screenshot');
    }
  };

  useEffect(() => {
    return () => {
      Object.keys(intervalRefs.current).forEach((url) => {
        clearInterval(intervalRefs.current[url]);
      });
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prevCountdown) => {
        if (prevCountdown > 0) {
          return prevCountdown - 1;
        } else {
          handleFetchLatestMetrics();
          return interval; // Reset countdown to interval value
        }
      });
    }, 1000);

    return () => {
      clearInterval(countdownIntervalRef.current);
    };
  }, [interval]);

  const formatCountdown = () => {
    const hours = Math.floor(countdown / 3600);
    const minutes = Math.floor((countdown % 3600) / 60);
    const seconds = countdown % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const handleSendTestPush = async () => {
    try {
      const response = await fetch('/api/send-test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send test push notification');
      }

      alert('Test push notification sent successfully!');
    } catch (error) {
      console.error('Error sending test push notification:', error);
      alert('Failed to send test push notification');
    }
  };

  return (
    <div className="container">
      <Head>
        <title>Reddit Monitoring</title>
        <meta name="description" content="Monitor Reddit posts" />
      </Head>
      <header className="header">
        <h1>Content Monitor</h1>
        <nav>
          <ul>
            <li><Link href="/reddit-authenticated">Reddit (Login)</Link></li>
            <li><Link href="/reddit-original">Reddit</Link></li>
            <li><Link href="/twitter">Twitter</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        <img src="/logo.png" alt="Logo" width={200} height={200} className="logo" />
        <form onSubmit={handleSubmit}>
          <div>
            <input type="file" onChange={handleFileUpload} />
          </div>
          {userGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <p>Please enter the url of all posts created by this user at once.</p>
              <div>
                <label htmlFor={`username-${groupIndex}`}>Username:</label>
                <input
                  type="text"
                  id={`username-${groupIndex}`}
                  name={`username-${groupIndex}`}
                  value={group.username}
                  onChange={(e) => handleGroupChange(groupIndex, 'username', e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor={`password-${groupIndex}`}>Password:</label>
                <input
                  type="password"
                  id={`password-${groupIndex}`}
                  name={`password-${groupIndex}`}
                  value={group.password}
                  onChange={(e) => handleGroupChange(groupIndex, 'password', e.target.value)}
                  required
                />
              </div>
              {group.urls.map((url, urlIndex) => (
                <div key={urlIndex}>
                  <label htmlFor={`url-${groupIndex}-${urlIndex}`}>Enter URL:</label>
                  <input
                    type="text"
                    id={`url-${groupIndex}-${urlIndex}`}
                    name={`url-${groupIndex}-${urlIndex}`}
                    value={url}
                    onChange={(e) => handleUrlChange(groupIndex, urlIndex, e.target.value)}
                    required
                    className={isValidUrls[urlIndex] ? '' : 'invalid'}
                  />
                  <button type="button" className='remove' onClick={() => removeUrlField(groupIndex, urlIndex)}>Remove URL</button>
                </div>
              ))}
              <button type="button" onClick={() => addUrlField(groupIndex)}>Add URL</button>
              <button type="button" className='remove' onClick={() => removeUserGroup(groupIndex)}>Remove User Group</button>
            </div>
          ))}
          <button type="button" onClick={addUserGroup}>Add User Group</button>
          <br />
          <button type="submit">Start Monitoring</button>
          <p>Post data can be updated automatically in backend. Press the button to read the latest metrics data.</p>
          <button type="button" onClick={handleFetchLatestMetrics}>Fetch Latest Metrics</button>
        </form>

        {/* Display countdown timer */}
        <div className="countdown-timer">
          <h2>Next fetch in: {formatCountdown()}</h2>
        </div>

        {/* Display usernames */}
        <div className="user-list">
          <h2>Usernames</h2>
          <ul>
            {userGroups.map((group, index) => (
              <li key={index}>
                <button onClick={() => setSelectedUser(group.username)}>{group.username}</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Display selected user's post details */}
        {selectedUser && (
          <div className="user-details">
            <h2>Post Details for {selectedUser}</h2>
            {userGroups
              .find(group => group.username === selectedUser)
              ?.urls.map((url, index) => (
                <div key={index}>
                  {postDetails[url] && (
                    <div className="post-details">
                      <h2>Post Details for {url}</h2>
                      <p><strong>Title:</strong> {postDetails[url].title}</p>
                      <p><strong>Post ID:</strong> {postDetails[url].post_id}</p>
                      <p><strong>Author:</strong> {postDetails[url].author}</p>
                      <p><strong>Created:</strong> {new Date(postDetails[url].created_utc * 1000).toLocaleString()}</p>
                      <p><strong>Subreddit:</strong> {postDetails[url].subreddit}</p>
                      <p><strong>Status:</strong> {postDetails[url].is_deleted ? 'Deleted or Removed by a Moderator' : 'Available'}</p>
                      <p><strong>DeletedTime:</strong> {postDetails[url].deleted_time}</p>
                      {loading && <p>Loading metrics...</p>}
                      {metrics && metrics.find(m => m.postID === postDetails[url].post_id) ? (
                        <div>
                          <h3>Metrics</h3>
                          <p><strong>Time of scraping:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).scrapeTime}</p>
                          <p><strong>Views:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numViews}</p>
                          <p><strong>Upvotes:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numUpvotes}</p>
                          <p><strong>Comments:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numComments}</p>
                          <p><strong>XPosts:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numXPosts}</p>
                        </div>
                      ) : (
                        <p>This post may not be created by this user.</p>
                      )}
                    </div>
                  )}
                  {!isValidUrls[index] && <div className="error">Invalid URL. Please enter a valid post URL.</div>}
                </div>
              ))}
          </div>
        )}

        <div>
          <h2>Download Data</h2>
          <label htmlFor="downloadUsername">Enter Username to Download Data:</label>
          <input
            type="text"
            id="downloadUsername"
            name="downloadUsername"
            value={downloadUsername || ''}
            onChange={(e) => setDownloadUsername(e.target.value)}
            required
          />
          <button type="button" onClick={() => handleDownload(downloadUsername)}>Download Data</button>
        </div>
        <div>
          <h2>Download All Data</h2>
          <button type="button" onClick={handleDownloadAll}>Download All Data</button>
        </div>
        <br />
        <div>
          <button onClick={handleDownloadBackupFiles}>Download Backup Files (from reddit API with deleted time)</button>
        </div>
        <div>
          <br />
          <h2>Debug</h2>
          <button onClick={handleShowScreenshot}>Debug: Show After-Login Screenshot</button>
          {screenshotUrl && <img src={screenshotUrl} alt="After Login Screenshot" />}
        </div>

        {/* Test push notification button */}
        <div>
          <h2>Send Test Push Notification</h2>
          <button onClick={handleSendTestPush}>Send Test Push Notification</button>
        </div>
      </main>
      <footer className="footer">
        <p>&copy; 2024</p>
      </footer>
    </div>
  );
}
