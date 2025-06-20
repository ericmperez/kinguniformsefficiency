import * as React from 'react';
import ReactMarkdown from 'react-markdown';

interface ContentProps {
  announcements?: string;
  announcementImage?: string | null;
}

const Content: React.FC<ContentProps> = ({ announcements, announcementImage }) => {
  return (
    <div style={{ padding: 32, color: '#333', maxWidth: 320 }}>
      {announcementImage && (
        <img
          src={announcementImage}
          alt="Announcement"
          style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 16 }}
        />
      )}
      {announcements ? (
        <ReactMarkdown
          children={announcements}
          components={{
            a: ({ node, ...props }) => <a style={{ color: '#007bff' }} {...props} />,
            strong: ({ node, ...props }) => <strong style={{ fontWeight: 700 }} {...props} />,
            em: ({ node, ...props }) => <em style={{ fontStyle: 'italic' }} {...props} />,
            li: ({ node, ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
          }}
        />
      ) : (
        <>
          <h3>Welcome!</h3>
          <p>Please sign in to continue.</p>
        </>
      )}
    </div>
  );
};

export default Content;
