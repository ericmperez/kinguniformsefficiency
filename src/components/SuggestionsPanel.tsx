import React, { useState, useEffect } from 'react';
import { Suggestion } from '../types';
import { getSuggestions, addSuggestion, updateSuggestion, deleteSuggestion } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface SuggestionsPanelProps {
  isVisible: boolean;
  onClose?: () => void;
}

export default function SuggestionsPanel({ isVisible, onClose }: SuggestionsPanelProps) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    description: '',
    category: 'improvement' as Suggestion['category'],
    priority: 'medium' as Suggestion['priority'],
  });

  // Real-time listener for suggestions
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'suggestions'), (snapshot) => {
      const suggestionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(doc.data().updatedAt),
      })) as Suggestion[];
      
      // Sort by creation date (newest first)
      suggestionsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSuggestions(suggestionsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSuggestion.title.trim() || !newSuggestion.description.trim()) return;

    try {
      await addSuggestion({
        title: newSuggestion.title.trim(),
        description: newSuggestion.description.trim(),
        category: newSuggestion.category,
        priority: newSuggestion.priority,
        status: 'pending',
        submittedBy: user.id,
        submittedByName: user.username,
      });

      // Reset form
      setNewSuggestion({
        title: '',
        description: '',
        category: 'improvement',
        priority: 'medium',
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      alert('Error submitting suggestion. Please try again.');
    }
  };

  const handleStatusChange = async (suggestionId: string, newStatus: Suggestion['status']) => {
    if (!user) return;

    try {
      await updateSuggestion(suggestionId, {
        status: newStatus,
        reviewedBy: user.id,
        reviewedByName: user.username,
      });
    } catch (error) {
      console.error('Error updating suggestion status:', error);
      alert('Error updating suggestion status. Please try again.');
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!user || !confirm('Are you sure you want to delete this suggestion?')) return;

    try {
      await deleteSuggestion(suggestionId);
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      alert('Error deleting suggestion. Please try again.');
    }
  };

  const getStatusColor = (status: Suggestion['status']) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'reviewed': return '#3b82f6';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'implemented': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: Suggestion['priority']) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: Suggestion['category']) => {
    switch (category) {
      case 'feature': return '✨';
      case 'improvement': return '🔧';
      case 'bug': return '🐛';
      case 'other': return '💡';
      default: return '📝';
    }
  };

  // Only Eric (1991) can manage (approve, reject, implement, delete, review notes)
  const canManageSuggestions = user && user.id === '1991';

  // Only supervisors+ (and Eric) can submit
  const canSubmitSuggestions = user && (
    user.id === '1991' || ['Supervisor', 'Admin', 'Owner'].includes(user.role)
  );

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '380px',
        height: '100vh',
        backgroundColor: '#ffffff',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '3px solid #0E62A0',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: '#0E62A0',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
          💡 Suggestions Center
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '28px',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 12,
              lineHeight: 1,
              padding: 0,
              transition: 'color 0.15s',
            }}
            aria-label="Close suggestions panel"
            title="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Add Suggestion Button (only for allowed roles) */}
      {canSubmitSuggestions && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: showAddForm ? '#dc2626' : '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {showAddForm ? '✕ Cancel' : '+ New Suggestion'}
          </button>
        </div>
      )}

      {/* Add Suggestion Form (only for allowed roles) */}
      {canSubmitSuggestions && showAddForm && (
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
          <form onSubmit={handleSubmitSuggestion}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                Title *
              </label>
              <input
                type="text"
                value={newSuggestion.title}
                onChange={(e) => setNewSuggestion(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter suggestion title..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                Description *
              </label>
              <textarea
                value={newSuggestion.description}
                onChange={(e) => setNewSuggestion(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your suggestion in detail..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                }}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  Category
                </label>
                <select
                  value={newSuggestion.category}
                  onChange={(e) => setNewSuggestion(prev => ({ ...prev, category: e.target.value as Suggestion['category'] }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="feature">Feature</option>
                  <option value="improvement">Improvement</option>
                  <option value="bug">Bug Report</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '14px' }}>
                  Priority
                </label>
                <select
                  value={newSuggestion.priority}
                  onChange={(e) => setNewSuggestion(prev => ({ ...prev, priority: e.target.value as Suggestion['priority'] }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: '#0E62A0',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Submit Suggestion
            </button>
          </form>
        </div>
      )}

      {/* Suggestions List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
            Loading suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>
            No suggestions yet. Be the first to submit one!
          </div>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              style={{
                margin: '0 16px 16px 16px',
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {/* Header with category icon and priority */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{getCategoryIcon(suggestion.category)}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: getPriorityColor(suggestion.priority),
                      textTransform: 'uppercase',
                    }}
                  >
                    {suggestion.priority}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '12px',
                    backgroundColor: getStatusColor(suggestion.status),
                    color: 'white',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                  }}
                >
                  {suggestion.status}
                </span>
              </div>

              {/* Title */}
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#1f2937' }}>
                {suggestion.title}
              </h4>

              {/* Description */}
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#4b5563', lineHeight: '1.4' }}>
                {suggestion.description}
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6b7280' }}>
                <div>
                  <div>By: {suggestion.submittedByName}</div>
                  <div>{new Date(suggestion.createdAt).toLocaleDateString()}</div>
                </div>
                
                {/* Management actions only for Eric (1991) */}
                {canManageSuggestions && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {suggestion.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(suggestion.id, 'approved')}
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(suggestion.id, 'rejected')}
                          style={{
                            padding: '4px 8px',
                            fontSize: '10px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {suggestion.status === 'approved' && (
                      <button
                        onClick={() => handleStatusChange(suggestion.id, 'implemented')}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          backgroundColor: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Mark Implemented
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSuggestion(suggestion.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>

              {/* Review notes */}
              {suggestion.reviewNotes && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '12px' }}>
                  <strong>Review Notes:</strong> {suggestion.reviewNotes}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
