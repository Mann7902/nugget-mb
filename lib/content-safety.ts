export interface SafetyResult {
  safe: boolean;
  issues: string[];
}

export class ContentSafetyChecker {
  private profanityWords = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'ass', 'bastard'
  ];

  private piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    /\b\d{3}-\d{3}-\d{4}\b/, // Phone
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
  ];

  checkContent(text: string): SafetyResult {
    const issues: string[] = [];
    const lowerText = text.toLowerCase();

    // Check for profanity
    for (const word of this.profanityWords) {
      if (lowerText.includes(word)) {
        issues.push(`Contains potentially inappropriate language: ${word}`);
      }
    }

    // Check for PII
    for (const pattern of this.piiPatterns) {
      if (pattern.test(text)) {
        issues.push('Contains potential personally identifiable information');
        break;
      }
    }

    // Check for excessive claims
    const claimWords = ['guarantee', 'promise', 'definitely will', 'always works'];
    for (const claim of claimWords) {
      if (lowerText.includes(claim)) {
        issues.push(`Contains strong claim that should be verified: ${claim}`);
      }
    }

    return {
      safe: issues.length === 0,
      issues
    };
  }

  sanitizeContent(text: string): string {
    let sanitized = text;

    // Remove or replace profanity
    for (const word of this.profanityWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    }

    // Remove PII
    for (const pattern of this.piiPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }
}