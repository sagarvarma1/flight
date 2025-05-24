import React, { useState, useEffect, useRef } from 'react';
import transcriptData from '../transcript.json';

const ConflictAlerts = ({ currentPlaybackIndex, currentTimestamp, conflicts }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new conflicts are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conflicts]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#dc2626';
      case 'WARNING': return '#f59e0b';
      case 'INFO': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ 
      border: '2px solid #000000', 
      padding: '1.5rem',
      backgroundColor: '#ffffff',
      minHeight: '400px'
    }}>
      <h2 style={{ 
        margin: '0 0 1rem 0', 
        fontSize: '1.5rem', 
        fontWeight: '400', 
        color: '#000000',
        fontFamily: 'serif'
      }}>
        Conflict Alerts
      </h2>
      
      <div 
        ref={scrollRef}
        style={{ 
          maxHeight: '350px', 
          overflowY: 'auto',
          fontSize: '0.9rem'
        }}
      >
        {conflicts.length === 0 ? (
          <div style={{ color: '#666666', fontStyle: 'italic' }}>
            No conflicts detected
          </div>
        ) : (
          conflicts.map(conflict => (
            <div key={conflict.id} style={{ 
              marginBottom: '1rem',
              padding: '0.75rem',
              border: `2px solid ${getSeverityColor(conflict.severity)}`,
              backgroundColor: `${getSeverityColor(conflict.severity)}10`
            }}>
              <div style={{ 
                fontWeight: 'bold',
                color: getSeverityColor(conflict.severity),
                marginBottom: '0.25rem'
              }}>
                {conflict.severity} - {conflict.type.replace('_', ' ').toUpperCase()}
              </div>
              <div style={{ 
                color: '#000000',
                fontSize: '0.85rem',
                lineHeight: '1.3'
              }}>
                {conflict.description}
              </div>
              {conflict.time_difference_seconds !== undefined && (
                <div style={{ 
                  color: '#666666',
                  fontSize: '0.8rem',
                  marginTop: '0.25rem'
                }}>
                  Time difference: {conflict.time_difference_seconds}s
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConflictAlerts; 