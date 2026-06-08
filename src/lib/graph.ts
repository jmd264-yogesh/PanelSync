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
    },
    accessToken: string
  ): Promise<CalendarEventResponse> {
    const endpoint = '/me/events';

    const attendees = [
      {
        emailAddress: {
          address: params.candidateEmail,
          name: params.candidateName,
        },
        type: 'required',
      },
      ...params.panelEmails.map((email) => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0], // Fallback name
        },
        type: 'required',
      })),
    ];

    const body = {
      subject: `Interview: ${params.candidateName} - ${params.role}`,
      body: {
        contentType: 'html',
        content: `
          <h3>Interview Schedule Confirmation</h3>
          <p><strong>Candidate:</strong> ${params.candidateName} (${params.candidateEmail})</p>
          <p><strong>Role:</strong> ${params.role}</p>
          <hr />
          <p>This interview is scheduled as an online Teams Meeting.</p>
          <p>${params.description.replace(/\n/g, '<br />')}</p>
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

    return {
      id: response.id,
      joinUrl: response.onlineMeeting?.joinUrl,
      webLink: response.webLink,
    };
  }
}

export const graph = new GraphService();
