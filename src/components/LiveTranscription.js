import React, { useState, useEffect, useRef } from 'react';
import transcriptData from '../transcript.json';

const LiveTranscription = ({ currentPlaybackIndex, currentTimestamp, messageConflicts }) => {
  const [currentMessages, setCurrentMessages] = useState([]);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages]);

  // Sync to global playback position
  useEffect(() => {
    if (currentPlaybackIndex >= 0 && currentPlaybackIndex < transcriptData.length) {
      // Get all messages up to current playback position
      const messagesToShow = transcriptData.slice(0, currentPlaybackIndex + 1);
      const last10Messages = messagesToShow.slice(-10); // Show last 10 messages
      
      setCurrentMessages(last10Messages);
    }
  }, [currentPlaybackIndex]);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#dc2626';
      case 'WARNING': return '#f59e0b';
      case 'INFO': return '#3b82f6';
      default: return '#000000';
    }
  };

  const getSeverityBackgroundColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#fef2f2';
      case 'WARNING': return '#fffbeb';
      case 'INFO': return '#eff6ff';
      default: return 'transparent';
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
        Live ATC Transcription
      </h2>
      
      <div 
        ref={scrollRef}
        style={{ 
          minHeight: '350px', 
          maxHeight: '350px', 
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.9rem'
        }}
      >
        {currentMessages.map((msg, index) => {
          const messageKey = `${msg.timestamp}-${msg.callsign}`;
          const conflictSeverity = messageConflicts.get(messageKey);
          const isConflict = !!conflictSeverity;
          
          // Remove duplicate callsign from message if it starts with the callsign
          const cleanMessage = msg.message.startsWith(msg.callsign + ',') || msg.message.startsWith(msg.callsign + ':')
            ? msg.message.substring(msg.callsign.length + 1).trim()
            : msg.message;
          
          return (
            <div key={`${msg.timestamp}-${index}`} style={{ 
              marginBottom: '0.5rem',
              color: isConflict ? getSeverityColor(conflictSeverity) : '#000000',
              backgroundColor: isConflict ? getSeverityBackgroundColor(conflictSeverity) : 'transparent',
              lineHeight: '1.4',
              padding: isConflict ? '0.25rem' : '0',
              border: isConflict ? `1px solid ${getSeverityColor(conflictSeverity)}` : 'none',
              borderRadius: isConflict ? '3px' : '0'
            }}>
              <span style={{ fontWeight: 'bold' }}>[{msg.timestamp}]</span> 
              <span style={{ fontWeight: 'bold', marginLeft: '0.5rem' }}>{msg.callsign}:</span> 
              <span style={{ marginLeft: '0.5rem' }}>{cleanMessage}</span>
            </div>
          );
        })}
        {currentMessages.length === 0 && (
          <div style={{ color: '#666666', fontStyle: 'italic' }}>
            Waiting for transmissions...
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveTranscription; 