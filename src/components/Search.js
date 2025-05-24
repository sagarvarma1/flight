import React, { useState } from 'react';
import transcriptData from '../transcript.json';

const Search = ({ onBack, currentPlaybackIndex, currentTimestamp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Convert time string to seconds for comparison
  const timeToSeconds = (timeStr) => {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Get only the messages that have been broadcast so far
  const getBroadcastMessages = () => {
    // Only include messages up to the current playback index
    return transcriptData.slice(0, currentPlaybackIndex + 1);
  };

  // Parse ATC message to extract relevant data
  const parseMessage = (msg) => {
    const text = msg.message.toLowerCase();
    const data = {
      timestamp: msg.timestamp,
      callsign: msg.callsign,
      originalMessage: msg.message,
      timestampSeconds: timeToSeconds(msg.timestamp),
      actions: []
    };

    // Extract actions
    if (text.includes('cleared to land')) {
      data.actions.push('Cleared to land');
    }
    if (text.includes('cleared for takeoff')) {
      data.actions.push('Cleared for takeoff');
    }
    if (text.includes('climb and maintain')) {
      data.actions.push('Climb and maintain');
    }
    if (text.includes('descend and maintain')) {
      data.actions.push('Descend and maintain');
    }
    if (text.match(/turn (left|right) heading/)) {
      data.actions.push('Turn heading');
    }

    // Extract runway information
    const runwayMatch = text.match(/runway\s+(\w+)/i);
    if (runwayMatch) {
      data.runway = runwayMatch[1].toUpperCase();
    }

    // Extract altitude
    const altitudeMatch = text.match(/maintain\s+(\d{4,5})/);
    if (altitudeMatch) {
      data.altitude = parseInt(altitudeMatch[1]);
    }

    return data;
  };

  // Find conflicts involving the searched aircraft (only in broadcast messages)
  const findConflicts = (callsign, allMessages) => {
    const conflicts = [];
    const aircraftMessages = allMessages.filter(msg => msg.callsign === callsign);

    aircraftMessages.forEach(currentMsg => {
      const currentTime = currentMsg.timestampSeconds;

      // Check for runway conflicts
      if (currentMsg.runway && (currentMsg.originalMessage.toLowerCase().includes('cleared to land') || 
                               currentMsg.originalMessage.toLowerCase().includes('cleared for takeoff'))) {
        const conflictingMessages = allMessages.filter(msg => 
          msg.callsign !== callsign &&
          Math.abs(currentTime - msg.timestampSeconds) <= 90 &&
          msg.runway === currentMsg.runway &&
          (msg.originalMessage.toLowerCase().includes('cleared to land') || 
           msg.originalMessage.toLowerCase().includes('cleared for takeoff'))
        );

        conflictingMessages.forEach(conflictMsg => {
          const timeDiff = Math.abs(currentTime - conflictMsg.timestampSeconds);
          const severity = timeDiff <= 30 ? 'CRITICAL' : 'WARNING';
          conflicts.push({
            type: 'Runway Conflict',
            severity,
            timestamp: currentMsg.timestamp,
            description: `${callsign} and ${conflictMsg.callsign} both cleared for runway ${currentMsg.runway}`,
            timeDifference: `${timeDiff}s apart`
          });
        });
      }

      // Check for altitude conflicts
      if (currentMsg.altitude) {
        const conflictingMessages = allMessages.filter(msg => 
          msg.callsign !== callsign &&
          Math.abs(currentTime - msg.timestampSeconds) <= 60 &&
          msg.altitude === currentMsg.altitude
        );

        conflictingMessages.forEach(conflictMsg => {
          const timeDiff = Math.abs(currentTime - conflictMsg.timestampSeconds);
          const severity = timeDiff <= 10 ? 'CRITICAL' : 'WARNING';
          conflicts.push({
            type: 'Altitude Conflict',
            severity,
            timestamp: currentMsg.timestamp,
            description: `${callsign} and ${conflictMsg.callsign} both assigned ${currentMsg.altitude} feet`,
            timeDifference: `${timeDiff}s apart`
          });
        });
      }

      // Check for duplicate clearances
      const duplicates = allMessages.filter(msg => 
        msg.callsign === callsign &&
        msg.timestamp !== currentMsg.timestamp &&
        Math.abs(currentTime - msg.timestampSeconds) <= 60 &&
        msg.originalMessage.toLowerCase() === currentMsg.originalMessage.toLowerCase()
      );

      if (duplicates.length > 0) {
        conflicts.push({
          type: 'Duplicate Clearance',
          severity: 'WARNING',
          timestamp: currentMsg.timestamp,
          description: `${callsign} received duplicate clearance`,
          timeDifference: 'Multiple instances'
        });
      }
    });

    // Remove duplicates
    const uniqueConflicts = conflicts.filter((conflict, index, self) => 
      index === self.findIndex(c => 
        c.type === conflict.type && 
        c.timestamp === conflict.timestamp && 
        c.description === conflict.description
      )
    );

    return uniqueConflicts;
  };

  const handleSearch = () => {
    setHasSearched(true);
    
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    const searchCallsign = searchTerm.trim().toUpperCase();
    
    // Get only broadcast messages (up to current playback position)
    const broadcastMessages = getBroadcastMessages();
    
    // Parse only the broadcast messages
    const allParsedMessages = broadcastMessages.map(parseMessage);
    
    // Find messages for this aircraft (only from broadcast messages)
    const aircraftMessages = allParsedMessages.filter(msg => 
      msg.callsign.toUpperCase() === searchCallsign
    );

    if (aircraftMessages.length === 0) {
      setSearchResults(null);
      return;
    }

    // Find conflicts for this aircraft (only from broadcast messages)
    const conflicts = findConflicts(searchCallsign, allParsedMessages);

    setSearchResults({
      callsign: searchCallsign,
      messages: aircraftMessages,
      conflicts: conflicts
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return '#dc2626';
      case 'WARNING': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: '1px solid #000000',
        paddingBottom: '1rem'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: '400', 
            color: '#000000',
            fontFamily: 'serif',
            margin: '0 0 0.5rem 0'
          }}>
            Aircraft Search
          </h1>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            Current time: {currentTimestamp || 'Starting...'} | Searching {currentPlaybackIndex + 1} of {transcriptData.length} messages
          </div>
        </div>
        <button 
          onClick={onBack}
          style={{
            padding: '0.5rem 1.5rem',
            border: '2px solid #000000',
            backgroundColor: '#ffffff',
            color: '#000000',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Back to Dashboard
        </button>
      </div>

      {/* Search Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '3rem'
      }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          width: '100%',
          maxWidth: '600px'
        }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter aircraft call sign (e.g., DAL123, VOI601)"
            style={{
              flex: 1,
              padding: '1rem',
              fontSize: '1.1rem',
              border: '2px solid #000000',
              borderRadius: '25px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              border: '2px solid #000000',
              backgroundColor: '#000000',
              color: '#ffffff',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div>
          {searchResults ? (
            <div>
              <h2 style={{ 
                fontSize: '1.5rem', 
                marginBottom: '2rem',
                color: '#000000',
                fontFamily: 'serif'
              }}>
                Results for {searchResults.callsign} (up to {currentTimestamp})
              </h2>

              {/* Actions */}
              <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ 
                  fontSize: '1.3rem', 
                  marginBottom: '1rem',
                  color: '#000000',
                  fontFamily: 'serif'
                }}>
                  All Communications ({searchResults.messages.length})
                </h3>
                <div style={{
                  border: '2px solid #000000',
                  backgroundColor: '#ffffff',
                  padding: '1.5rem',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {searchResults.messages.map((msg, index) => (
                    <div key={index} style={{
                      marginBottom: '1rem',
                      padding: '0.75rem',
                      border: '1px solid #ccc',
                      backgroundColor: '#f9f9f9',
                      fontFamily: 'monospace'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        [{msg.timestamp}]
                      </div>
                      <div>{msg.originalMessage}</div>
                      {msg.actions.length > 0 && (
                        <div style={{ 
                          marginTop: '0.5rem', 
                          fontSize: '0.9rem', 
                          color: '#666',
                          fontStyle: 'italic'
                        }}>
                          Actions: {msg.actions.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflicts */}
              <div>
                <h3 style={{ 
                  fontSize: '1.3rem', 
                  marginBottom: '1rem',
                  color: '#000000',
                  fontFamily: 'serif'
                }}>
                  Conflicts Detected ({searchResults.conflicts.length})
                </h3>
                {searchResults.conflicts.length > 0 ? (
                  <div style={{
                    border: '2px solid #000000',
                    backgroundColor: '#ffffff',
                    padding: '1.5rem'
                  }}>
                    {searchResults.conflicts.map((conflict, index) => (
                      <div key={index} style={{
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
                          {conflict.severity} - {conflict.type}
                        </div>
                        <div style={{ marginBottom: '0.25rem' }}>
                          [{conflict.timestamp}] {conflict.description}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>
                          {conflict.timeDifference}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    border: '2px solid #000000',
                    backgroundColor: '#ffffff',
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#666',
                    fontStyle: 'italic'
                  }}>
                    No conflicts detected for this aircraft (so far)
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              border: '2px solid #000000',
              backgroundColor: '#ffffff'
            }}>
              <h2 style={{ 
                fontSize: '1.5rem', 
                color: '#dc2626',
                marginBottom: '1rem',
                fontFamily: 'serif'
              }}>
                Call sign not found
              </h2>
              <p style={{ color: '#666', fontSize: '1.1rem' }}>
                No aircraft found with call sign "{searchTerm}" in the broadcast messages so far. 
                {currentPlaybackIndex < transcriptData.length - 1 && (
                  <><br />The aircraft may appear later in the timeline.</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search; 