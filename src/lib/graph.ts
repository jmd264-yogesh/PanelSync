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
}

export const graph = new GraphService();

