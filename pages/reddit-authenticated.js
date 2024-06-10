import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [logs, setLogs] = useState({});
  const [postDetails, setPostDetails] = useState({});
  const [error, setError] = useState({});
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadUsername, setDownloadUsername] = useState('');

  const intervalRefs = useRef({});
  const [credentials, setCredentials] = useState([]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    fetchMetrics();
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/reddit-login-scraper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
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

  const handleFetchLatestMetrics = async () => {
    try {
      const promises = credentials.map(async (credential) => {
        const response = await fetch(`/api/fetch-latest-metrics?username=${credential.username}`);
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
      });

      await Promise.all(promises);
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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const parsedCredentials = JSON.parse(content);
      setCredentials(parsedCredentials);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    return () => {
      Object.keys(intervalRefs.current).forEach((url) => {
        clearInterval(intervalRefs.current[url]);
      });
    };
  }, []);

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
            <li><Link href="/">Reddit</Link></li>
          
            <li><Link href="/twitter">Twitter</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        <img src="/logo.png" alt="Logo" width={200} height={200} className="logo" />
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="file-upload">Upload JSON file with credentials:</label>
            <input type="file" id="file-upload" name="file-upload" accept=".json" onChange={handleFileUpload} required />
          </div>
          <button type="submit">Start Monitoring</button>
          <p>Post data can be updated automatically in backend. Press the button to read the latest metrics data.</p>
          <button type="button" onClick={handleFetchLatestMetrics}>Fetch Latest Metrics</button>
        </form>

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
          <button type="button" onClick={() => handleDownloadAll()}>Download All Data</button>
        </div>

        {credentials.map((credential, index) => (
          <div key={index}>
            <div id="log">
              <pre>{logs[credential.username]}</pre>
            </div>
            {postDetails[credential.username] && (
              <div className="post-details">
                <h2>Post Details for {credential.username}</h2>
                <p><strong>Title:</strong> {postDetails[credential.username].title}</p>
                <p><strong>Post ID:</strong> {postDetails[credential.username].post_id}</p>
                <p><strong>Author:</strong> {postDetails[credential.username].author}</p>
                <p><strong>Created:</strong> {new Date(postDetails[credential.username].created_utc * 1000).toLocaleString()}</p>
                <p><strong>Subreddit:</strong> {postDetails[credential.username].subreddit}</p>
                <p><strong>Status:</strong> {postDetails[credential.username].is_deleted ? 'Deleted or Removed by a Moderator' : 'Available'}</p>
                {loading && <p>Loading metrics...</p>}
                {metrics && metrics.find(m => m.postID === postDetails[credential.username].post_id) ? (
                  <div>
                    <h3>Metrics</h3>
                    <p><strong>Time of scraping:</strong> {metrics.find(m => m.postID === postDetails[credential.username].post_id).scrapeTime}</p>
                    <p><strong>Views:</strong> {metrics.find(m => m.postID === postDetails[credential.username].post_id).numViews}</p>
                    <p><strong>Upvotes:</strong> {metrics.find(m => m.postID === postDetails[credential.username].post_id).numUpvotes}</p>
                    <p><strong>Comments:</strong> {metrics.find(m => m.postID === postDetails[credential.username].post_id).numComments}</p>
                    <p><strong>XPosts:</strong> {metrics.find(m => m.postID === postDetails[credential.username].post_id).numXPosts}</p>
                  </div>
                ) : (
                  <p>This post may not be created by this user.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </main>
      <footer className="footer">
        <p>&copy; 2024 </p>
      </footer>
    </div>
  );
}
