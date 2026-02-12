export class DiscordService {
  private webhookUrl: string

  constructor() {
    this.webhookUrl = import.meta.env.VITE_DISCORD_ERROR_URL
  }

  async sendError(title: string, details: any): Promise<void> {
    if (!this.webhookUrl) return

    const embeds = [
      {
        title: `🚨 ${title}`,
        color: 15158332, // Red color
        fields: [
          {
            name: 'Details',
            value: this.formatDetails(details)
          },
          {
            name: 'Time',
            value: new Date().toISOString()
          },
          {
            name: 'User Agent',
            value: navigator.userAgent
          }
        ]
      }
    ]

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ embeds })
      })
    } catch (error) {
      console.error('Failed to send error to Discord:', error)
    }
  }

  private formatDetails(details: any): string {
    if (typeof details === 'string') return details
    if (details instanceof Error) {
      return `**Message:** ${details.message}\n**Stack:**\n\`\`\`${
        details.stack?.substring(0, 800) || 'No stack trace'
      }\`\`\``
    }
    try {
      return `\`\`\`json\n${JSON.stringify(details, null, 2).substring(0, 800)}\n\`\`\``
    } catch {
      return String(details)
    }
  }
}

export const discordLogger = new DiscordService()
