export interface GraphUser {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
}

export interface TeamsChatResponse {
  id: string;
  topic?: string | null;
  webUrl: string;
}

export interface TeamsMessageResponse {
  id: string;
}

export interface CalendarEventResponse {
  id: string;
  joinUrl?: string;
  webLink?: string;
}

class GraphService {
  private async fetchGraph(endpoint: string, accessToken: string, options: RequestInit = {}) {
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Graph API Error calling ${endpoint}:`, errText);
      throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  // 1. Search users in organization (using $filter to ensure maximum compatibility)
  async searchUsers(query: string, accessToken: string): Promise<GraphUser[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      // Escape single quotes for OData filter syntax
      const escapedQuery = query.replace(/'/g, "''");
      const filter = `startswith(displayName,'${escapedQuery}') or startswith(mail,'${escapedQuery}') or startswith(userPrincipalName,'${escapedQuery}')`;
      const endpoint = `/users?$filter=${encodeURIComponent(filter)}&$select=id,displayName,mail,userPrincipalName&$top=10`;
      
      const result = await this.fetchGraph(endpoint, accessToken);
      return result.value || [];
    } catch (error) {
      console.warn('Graph search using filter failed, trying advanced search query...', error);
      // Fallback to ConsistencyLevel: eventual advanced search (requires advanced query params)
      try {
        const escapedQuery = query.replace(/"/g, '\\"');
        const endpoint = `/users?$search="displayName:${escapedQuery}" OR "mail:${escapedQuery}"&$select=id,displayName,mail,userPrincipalName&$top=10`;
        const result = await this.fetchGraph(endpoint, accessToken, {
          headers: {
            ConsistencyLevel: 'eventual',
          },
        });
        return result.value || [];
      } catch (err2) {
        console.error('All user search methods failed:', err2);
        return [];
      }
    }
  }

  // 2. Create a 1:1 chat between recruiter and a panel member
  async createOneOnOneChat(recruiterId: string, panelUserId: string, accessToken: string): Promise<TeamsChatResponse> {
    const endpoint = '/chats';
    const body = {
      chatType: 'oneOnOne',
      members: [
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recruiterId}')`,
        },
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${panelUserId}')`,
        },
      ],
    };

    return await this.fetchGraph(endpoint, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // 3. Send Teams chat message
  async sendTeamsMessage(chatId: string, htmlContent: string, accessToken: string): Promise<TeamsMessageResponse> {
    const endpoint = `/chats/${chatId}/messages`;
    const body = {
      body: {
        contentType: 'html',
        content: htmlContent,
      },
    };

    return await this.fetchGraph(endpoint, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // 4. Create calendar event with online Teams meeting
  async createTeamsMeeting(
    recruiterEmail: string,
    params: {
      candidateName: string;
      candidateEmail: string;
      role: string;
      description: string;
      startTime: string; // ISO String UTC
      endTime: string;   // ISO String UTC
      panelEmails: string[];
      ccEmails?: string[];
    },
    accessToken: string
  ): Promise<CalendarEventResponse> {
    const endpoint = '/me/events';

    const attendees = [];
    if (params.candidateEmail && params.candidateEmail !== 'pending@assign.com' && params.candidateEmail !== '') {
      attendees.push({
        emailAddress: {
          address: params.candidateEmail,
          name: params.candidateName,
        },
        type: 'required',
      });
    }
    
    attendees.push(
      ...params.panelEmails.map((email) => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0], // Fallback name
        },
        type: 'required',
      }))
    );

    if (params.ccEmails && params.ccEmails.length > 0) {
      attendees.push(
        ...params.ccEmails.map((email) => ({
          emailAddress: {
            address: email,
            name: email.split('@')[0],
          },
          type: 'optional',
        }))
      );
    }

    const body = {
      subject: `Interview: ${params.candidateName} - ${params.role}`,
      body: {
        contentType: 'html',
        content: `
          <p>Hi ${params.candidateName || 'Candidate'},</p>
          <p>We are happy to take your candidature for the First level of Discussion.</p>
          <p>Blocking your calendar for the Technical Interview. Kindly make yourself available for the same. Please find below few general instructions.</p>
          <ol>
            <li>Join at least five minutes prior to the scheduled time.</li>
            <li>Make sure you have stable internet connectivity, at least 5mbps.</li>
            <li>Check your microphone and camera settings before the start of the interview.</li>
            <li>Join the interview using a laptop/desktop only.</li>
            <li>Please join the link via web if you do not have Microsoft teams installed.</li>
          </ol>
          <p>Regards,<br />TA Team<br />JMAN Group</p>
          <hr />
          <p><strong>Role/Focus:</strong> ${params.role}</p>
          ${params.description ? `<p>${params.description.replace(/\n/g, '<br />')}</p>` : ''}
        `,
      },
      start: {
        dateTime: params.startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: params.endTime,
        timeZone: 'UTC',
      },
      location: {
        displayName: 'Microsoft Teams Meeting',
      },
      attendees,
      allowNewTimeProposals: true,
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
    };

    const response = await this.fetchGraph(endpoint, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const joinUrl = response.onlineMeeting?.joinUrl || response.onlineMeetingUrl;

    if (joinUrl) {
      try {
        const eventId = response.id;
        const updatedBody = {
          body: {
            contentType: 'html',
            content: `
              <p>Hi ${params.candidateName || 'Candidate'},</p>
              <p>We are happy to take your candidature for the First level of Discussion.</p>
              <p>Blocking your calendar for the Technical Interview. Kindly make yourself available for the same. Please find below few general instructions.</p>
              <ol>
                <li>Join at least five minutes prior to the scheduled time.</li>
                <li>Make sure you have stable internet connectivity, at least 5mbps.</li>
                <li>Check your microphone and camera settings before the start of the interview.</li>
                <li>Join the interview using a laptop/desktop only.</li>
                <li>Please join the link via web if you do not have Microsoft teams installed.</li>
              </ol>
              <p style="font-size: 16px; margin: 20px 0;">
                <strong>Microsoft Teams Meeting Link:</strong><br />
                <a href="${joinUrl}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; margin-top: 8px;">
                  Join Microsoft Teams Meeting
                </a>
              </p>
              <p style="font-size: 12px; color: #64748b;">
                Or copy and paste this link in your browser:<br />
                <a href="${joinUrl}" style="color: #6366f1;">${joinUrl}</a>
              </p>
              <p>Regards,<br />TA Team<br />JMAN Group</p>
              <hr />
              <p><strong>Role/Focus:</strong> ${params.role}</p>
              ${params.description ? `<p>${params.description.replace(/\n/g, '<br />')}</p>` : ''}
            `
          }
        };

        await this.fetchGraph(`/me/events/${eventId}`, accessToken, {
          method: 'PATCH',
          body: JSON.stringify(updatedBody),
        });
      } catch (patchError) {
        console.error('Failed to patch Teams join URL into event description:', patchError);
      }
    }

    return {
      id: response.id,
      joinUrl,
      webLink: response.webLink,
    };
  }

  // 5. Update calendar event with candidate details (PATCH)
  async updateTeamsMeeting(
    eventId: string,
    params: {
      candidateName: string;
      candidateEmail: string;
      role: string;
      description: string;
      panelEmails: string[];
      sendAsTeamsMeeting?: boolean;
      teamsMeetingUrl?: string;
      ccEmails?: string[];
    },
    accessToken: string
  ): Promise<any> {
    const endpoint = `/me/events/${encodeURIComponent(eventId)}`;

    const attendees = [];
    if (params.candidateEmail && params.candidateEmail !== 'pending@assign.com' && params.candidateEmail !== '') {
      attendees.push({
        emailAddress: {
          address: params.candidateEmail,
          name: params.candidateName,
        },
        type: 'required',
      });
    }
    
    attendees.push(
      ...params.panelEmails.map((email) => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0], // Fallback name
        },
        type: 'required',
      }))
    );

    if (params.ccEmails && params.ccEmails.length > 0) {
      attendees.push(
        ...params.ccEmails.map((email) => ({
          emailAddress: {
            address: email,
            name: email.split('@')[0],
          },
          type: 'optional',
        }))
      );
    }

    let joinUrl = params.teamsMeetingUrl;
    if (!joinUrl && params.sendAsTeamsMeeting !== false) {
      try {
        const eventDetail = await this.fetchGraph(`/me/events/${encodeURIComponent(eventId)}`, accessToken);
        joinUrl = eventDetail.onlineMeeting?.joinUrl || eventDetail.onlineMeetingUrl;
      } catch (e) {
        console.error('Failed to fetch event detail for join URL:', e);
      }
    }

    const body: any = {
      subject: `Interview: ${params.candidateName} - ${params.role}`,
      body: {
        contentType: 'html',
        content: `
          <p>Hi ${params.candidateName || 'Candidate'},</p>
          <p>We are happy to take your candidature for the First level of Discussion.</p>
          <p>Blocking your calendar for the Technical Interview. Kindly make yourself available for the same. Please find below few general instructions.</p>
          <ol>
            <li>Join at least five minutes prior to the scheduled time.</li>
            <li>Make sure you have stable internet connectivity, at least 5mbps.</li>
            <li>Check your microphone and camera settings before the start of the interview.</li>
            <li>Join the interview using a laptop/desktop only.</li>
            <li>Please join the link via web if you do not have Microsoft teams installed.</li>
          </ol>
          ${joinUrl ? `
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>Microsoft Teams Meeting Link:</strong><br />
              <a href="${joinUrl}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; margin-top: 8px;">
                Join Microsoft Teams Meeting
              </a>
            </p>
            <p style="font-size: 12px; color: #64748b;">
              Or copy and paste this link in your browser:<br />
              <a href="${joinUrl}" style="color: #6366f1;">${joinUrl}</a>
            </p>
          ` : ''}
          <p>Regards,<br />TA Team<br />JMAN Group</p>
          <hr />
          <p><strong>Role/Focus:</strong> ${params.role}</p>
          ${params.description ? `<p>${params.description.replace(/\n/g, '<br />')}</p>` : ''}
        `,
      },
      attendees,
    };

    body.isOnlineMeeting = params.sendAsTeamsMeeting !== false;
    if (params.sendAsTeamsMeeting !== false) {
      body.onlineMeetingProvider = 'teamsForBusiness';
    }

    return await this.fetchGraph(endpoint, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // Delete a calendar event
  async deleteCalendarEvent(eventId: string, accessToken: string): Promise<void> {
    const endpoint = `/me/events/${encodeURIComponent(eventId)}`;
    await this.fetchGraph(endpoint, accessToken, {
      method: 'DELETE',
    });
  }

  // Resolve a OneDrive/SharePoint sharing URL to its underlying file, using the
  // signed-in user's own delegated access (Files.Read) — works for anything
  // shared with them, without needing app-only/tenant-wide file permissions.
  async resolveSharedFile(shareUrl: string, accessToken: string): Promise<{ downloadUrl: string; name: string; size: number }> {
    const encodedShareId = 'u!' + Buffer.from(shareUrl, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const endpoint = `/shares/${encodedShareId}/driveItem`;
    const item = await this.fetchGraph(endpoint, accessToken);

    const downloadUrl = item?.['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) {
      throw new Error('Could not resolve a downloadable file from this OneDrive/SharePoint link.');
    }

    return { downloadUrl, name: item.name || 'resume', size: item.size || 0 };
  }

  // 7. Get online meeting by Join URL
  async getOnlineMeetingByJoinUrl(joinUrl: string, accessToken: string): Promise<{ id: string; subject?: string } | null> {
    try {
      const escapedUrl = joinUrl.replace(/'/g, "''");
      const endpoint = `/me/onlineMeetings?$filter=JoinWebUrl eq '${encodeURIComponent(escapedUrl)}'`;
      const result = await this.fetchGraph(endpoint, accessToken);
      if (result.value && result.value.length > 0) {
        return result.value[0];
      }
      return null;
    } catch (err) {
      console.warn('Failed to query online meeting by filter, trying list scan fallback...', err);
      return null;
    }
  }

  // 8. List transcripts for an online meeting
  async listMeetingTranscripts(meetingId: string, accessToken: string): Promise<{ id: string; createdDateTime: string }[]> {
    const endpoint = `/me/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts`;
    const result = await this.fetchGraph(endpoint, accessToken);
    return result.value || [];
  }

  // 9. Fetch transcript content (WebVTT text)
  async getTranscriptContent(meetingId: string, transcriptId: string, accessToken: string): Promise<string> {
    const endpoint = `/me/onlineMeetings/${encodeURIComponent(meetingId)}/transcripts/${encodeURIComponent(transcriptId)}/content?$format=text/vtt`;
    
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/vtt',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Graph API Error fetching transcript content:`, errText);
      throw new Error(`Graph API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    return await response.text();
  }

  // 10. Parse WebVTT, audio transcription, or plain transcript text into structured dialogue turns
  parseTranscript(rawText: string): {
    turns: { speaker: string; timestamp?: string; text: string }[];
    formattedText: string;
  } {
    if (!rawText || !rawText.trim()) {
      return { turns: [], formattedText: '' };
    }

    const normalizeTimestamp = (raw: string): string => {
      if (!raw) return '';
      const cleaned = raw.replace(/[\[\]]/g, '').trim().replace(',', '.');
      const parts = cleaned.split(':');
      if (parts.length === 2) {
        const mm = parts[0].padStart(2, '0');
        const [sec, ms] = parts[1].split('.');
        const ss = (sec || '00').padStart(2, '0');
        const mss = (ms || '000').padEnd(3, '0').slice(0, 3);
        return `00:${mm}:${ss}.${mss}`;
      } else if (parts.length === 3) {
        const hh = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const [sec, ms] = parts[2].split('.');
        const ss = (sec || '00').padStart(2, '0');
        const mss = (ms || '000').padEnd(3, '0').slice(0, 3);
        return `${hh}:${mm}:${ss}.${mss}`;
      }
      return cleaned;
    };

    const lines = rawText.split(/\r?\n/);
    const turns: { speaker: string; timestamp?: string; text: string }[] = [];
    let currentTimestamp = '';
    let currentSpeaker = 'Speaker';
    let currentTextLines: string[] = [];

    const flushTurn = () => {
      if (currentTextLines.length > 0) {
        const text = currentTextLines.join(' ').trim();
        if (text) {
          // If the last turn was from the same speaker and without a distinct timestamp, append text
          if (turns.length > 0 && turns[turns.length - 1].speaker === currentSpeaker && !currentTimestamp) {
            turns[turns.length - 1].text += ' ' + text;
          } else {
            turns.push({
              speaker: currentSpeaker,
              timestamp: currentTimestamp || undefined,
              text,
            });
          }
        }
        currentTextLines = [];
      }
    };

    const vttTimecodeRegex = /(?:(\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*(?:(\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/;
    const cueIdRegex = /^(?:[0-9a-fA-F-]{8,}\/\d+-\d+|\d+)$/;
    let insideVoiceTag = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) continue;

      // Ignore Teams Cue identifiers (e.g. "ab63e3ef-3eb1-4326-9173-04c3b677e69b/5-0" or simple numbers)
      if (cueIdRegex.test(line)) {
        continue;
      }

      // Ignore audio part headers (e.g. "--- Audio Part 2 ---" or "--- Live Recording Part 1 ---")
      if (/^---\s*(?:Audio|Live Recording|Recording)\s*Part\s*\d+\s*---$/i.test(line)) {
        flushTurn();
        continue;
      }

      // WebVTT arrow cue "00:00:01.000 --> 00:00:05.000"
      if (vttTimecodeRegex.test(line)) {
        flushTurn();
        const match = line.match(vttTimecodeRegex);
        currentTimestamp = match ? normalizeTimestamp(match[0].split('-->')[0].trim()) : '';
        insideVoiceTag = false;
        continue;
      }

      // Check for voice tag opening <v Speaker>
      const voiceOpenMatch = line.match(/^<v\s+([^>]+)>(.*)$/i);
      if (voiceOpenMatch) {
        flushTurn();
        currentSpeaker = voiceOpenMatch[1].trim();
        const speech = voiceOpenMatch[2].replace(/<\/v>/gi, '').replace(/<[^>]+>/g, '').trim();
        if (speech) currentTextLines.push(speech);
        insideVoiceTag = !line.includes('</v>');
        continue;
      }

      // If we're inside a multiline voice tag
      if (insideVoiceTag) {
        const speech = line.replace(/<\/v>/gi, '').replace(/<[^>]+>/g, '').trim();
        if (speech) currentTextLines.push(speech);
        if (line.includes('</v>')) insideVoiceTag = false;
        continue;
      }

      // Check for speaker declaration with optional leading timestamp and markdown bolding
      // Examples: "**[00:00] Interviewer:**", "[00:00:01.000] Candidate:", "**Interviewer:**", "Candidate:"
      const speakerPattern = /^(?:\*\*)?(?:\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[\.,]\d{1,3})?)\]?)?\s*(?:\*\*)?\s*(?:\*\*)?([A-Za-z0-9\s._\-()]+?)(?:\*\*)?:\s*(.*)$/;
      const speakerMatch = line.match(speakerPattern);
      if (speakerMatch && speakerMatch[2].length < 60 && !/^(?:https?|note|vtt|here is the)/i.test(speakerMatch[2])) {
        flushTurn();
        currentTimestamp = normalizeTimestamp(speakerMatch[1]) || currentTimestamp;
        currentSpeaker = speakerMatch[2].replace(/\*\*/g, '').trim();
        const speech = speakerMatch[3].replace(/\*\*/g, '').replace(/<[^>]+>/g, '').trim();
        if (speech) currentTextLines.push(speech);
        continue;
      }

      // Plain continuation text
      const cleaned = line.replace(/\*\*/g, '').replace(/<[^>]+>/g, '').trim();
      if (cleaned) {
        currentTextLines.push(cleaned);
      }
    }

    flushTurn();

    // Build unified formatted text string matching the manual upload format
    const formattedText = turns
      .map((t) => {
        const timePrefix = t.timestamp ? `[${t.timestamp}] ` : '';
        return `${timePrefix}${t.speaker}: ${t.text}`;
      })
      .join('\n\n');

    return { turns, formattedText: formattedText || rawText };
  }
}

export const graph = new GraphService();

const ONEDRIVE_HOST_PATTERN = /(^|\.)sharepoint\.com$|^1drv\.ms$|^onedrive\.live\.com$/i;

export function isOneDriveOrSharePointUrl(url: string): boolean {
  try {
    return ONEDRIVE_HOST_PATTERN.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

