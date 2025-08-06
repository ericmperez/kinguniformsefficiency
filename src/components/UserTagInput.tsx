import React, { useState, useRef, useEffect } from 'react';
import { getUsers } from '../services/firebaseService';

interface UserOption {
  id: string;
  username: string;
}

interface UserTagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const UserTagInput: React.FC<UserTagInputProps> = ({ value, onChange, placeholder }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownUsers, setDropdownUsers] = useState<UserOption[]>([]);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsers().then(users => {
      setAllUsers(users.map(u => ({ id: u.id, username: u.username })));
    });
  }, []);

  // Detect @ and show dropdown
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const match = /@([\w]*)$/.exec(val.slice(0, e.target.selectionStart || 0));
    if (match) {
      const search = match[1].toLowerCase();
      const filtered = allUsers.filter(u => u.username.toLowerCase().startsWith(search));
      setDropdownUsers(filtered);
      setShowDropdown(filtered.length > 0);
      setDropdownIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  // Handle selection
  const handleSelect = (user: UserOption) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart || 0;
    const before = value.slice(0, cursor).replace(/@([\w]*)$/, `@${user.username} `);
    const after = value.slice(cursor);
    onChange(before + after);
    setShowDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      setDropdownIndex(i => (i + 1) % dropdownUsers.length);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setDropdownIndex(i => (i - 1 + dropdownUsers.length) % dropdownUsers.length);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      handleSelect(dropdownUsers[dropdownIndex]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Render tags as chips
  const renderValue = () => {
    const parts = value.split(/(@[\w]+)/g);
    return parts.map((part, i) => {
      if (/^@[\w]+$/.test(part)) {
        return <span key={i} style={{ background: '#e0f2fe', color: '#0284c7', borderRadius: 4, padding: '0 4px', marginRight: 2 }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Click outside to close dropdown
  useEffect(() => {
    if (!showDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-tag-dropdown')) setShowDropdown(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [showDropdown]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', pointerEvents: 'none', color: 'transparent', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 'inherit', zIndex: 1 }}>
        {renderValue()}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ background: 'transparent', position: 'relative', zIndex: 2, width: '100%' }}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="user-tag-dropdown" style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 10, width: '100%' }}>
          {dropdownUsers.map((user, i) => (
            <div
              key={user.id}
              style={{ padding: 8, background: i === dropdownIndex ? '#bae6fd' : undefined, cursor: 'pointer' }}
              onMouseDown={e => { e.preventDefault(); handleSelect(user); }}
            >
              @{user.username}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserTagInput;
