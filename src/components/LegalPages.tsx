'use client';

import React from 'react';

interface LegalPageProps {
  onClose: () => void;
}

export const TermsOfService: React.FC<LegalPageProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 30px',
        borderBottom: '1px solid rgba(0, 255, 65, 0.1)',
        backgroundColor: '#0a0a0a',
      }}>
        <h1 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 24,
          color: '#00ff41',
          margin: 0,
          letterSpacing: 2,
        }}>
          TERMS OF SERVICE
        </h1>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            color: '#00ff41',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: 14,
            borderRadius: 2,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(0, 255, 65, 0.1)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
          }}
        >
          CLOSE
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '30px',
        color: '#e0e0e0',
        fontFamily: 'Chakra Petch, sans-serif',
        fontSize: 14,
        lineHeight: 1.6,
      }}>
        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            SERVICE DESCRIPTION
          </h2>
          <p>
            GUNS UP FITNESS is an AI-powered fitness platform that provides workout programming, nutrition guidance, and training support through Claude AI ("Gunny"). The service includes workout tracking, meal logging, performance metrics, trainer collaboration, and community features designed to help operators achieve their fitness goals.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            ELIGIBILITY
          </h2>
          <p>
            You must be at least 18 years of age to use GUNS UP FITNESS. By accessing this service, you represent and warrant that you meet this age requirement. We reserve the right to verify age and suspend access for non-compliance.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            ACCOUNT TERMS
          </h2>
          <p>
            Users are responsible for maintaining the confidentiality of their account credentials. Authentication may be via email/password or PIN login. You are responsible for all activity that occurs under your account. Notify us immediately of any unauthorized access. We are not liable for loss or damage resulting from your failure to protect your credentials.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            SUBSCRIPTION & BILLING
          </h2>
          <p>
            GUNS UP FITNESS offers four subscription tiers:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>Recon:</strong> $2/month</li>
            <li><strong>Operator:</strong> $5/month</li>
            <li><strong>Commander:</strong> $15/month</li>
            <li><strong>Warfighter:</strong> $49.99/month</li>
          </ul>
          <p>
            Billing occurs monthly or annually based on your selection. You may cancel your subscription at any time. Cancellations are effective at the end of the current billing period. No refunds are provided for partial months of service. Failed payments may result in service suspension.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            TRAINER REVENUE SHARE
          </h2>
          <p>
            Trainers earn 25-40% of client subscription revenue, tiered by performance and client count. Payouts are processed monthly via Stripe Connect to the trainer's registered account. Trainers must provide valid tax documentation for payments. Commissions are subject to platform rules and may be adjusted annually.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            AI DISCLAIMER
          </h2>
          <p>
            Gunny AI provides general fitness guidance and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a physician before starting any exercise program, especially if you have pre-existing conditions, injuries, or health concerns. The AI may make errors or provide suboptimal recommendations. Do not rely solely on AI guidance for critical health decisions. Seek licensed medical and fitness professionals as needed.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            USER-GENERATED DATA & AI TRAINING
          </h2>
          <p>
            User-generated data including workouts, meals, feedback, and performance metrics are stored securely and may be used to improve AI training with anonymization. Personal identifying information is never used in AI training without explicit consent. You retain ownership of your data and may request deletion at any time.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            LIMITATION OF LIABILITY
          </h2>
          <p>
            GUNS UP FITNESS is provided "as is" without warranties. We are not liable for injuries, damages, or losses resulting from use of the service. This limitation applies to indirect, incidental, consequential, and punitive damages. The service is not a substitute for professional medical, legal, or fitness guidance. Your use of the service is at your own risk.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            TERMINATION
          </h2>
          <p>
            Either party may terminate service at any time. Upon termination, your account data is retained for 30 days before permanent deletion. You may request immediate deletion by contacting support. Termination does not eliminate your obligations under these terms, including payment for services rendered.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            GOVERNING LAW
          </h2>
          <p>
            These Terms of Service are governed by the laws of the State of California, without regard to conflict of law principles. You agree to submit to the exclusive jurisdiction of California courts.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            CONTACT
          </h2>
          <p>
            For questions or concerns, contact us at <strong>support@gunsupfitness.com</strong>
          </p>
        </section>

        <section style={{ marginBottom: 60 }}>
          <p style={{ color: '#888', fontSize: 12, marginTop: 20 }}>
            <strong>Last Updated:</strong> March 2026
          </p>
        </section>
      </div>
    </div>
  );
};

export const PrivacyPolicy: React.FC<LegalPageProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 30px',
        borderBottom: '1px solid rgba(0, 255, 65, 0.1)',
        backgroundColor: '#0a0a0a',
      }}>
        <h1 style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 24,
          color: '#00ff41',
          margin: 0,
          letterSpacing: 2,
        }}>
          PRIVACY POLICY
        </h1>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(0, 255, 65, 0.3)',
            color: '#00ff41',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: 'Chakra Petch, sans-serif',
            fontSize: 14,
            borderRadius: 2,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'rgba(0, 255, 65, 0.1)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
          }}
        >
          CLOSE
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '30px',
        color: '#e0e0e0',
        fontFamily: 'Chakra Petch, sans-serif',
        fontSize: 14,
        lineHeight: 1.6,
      }}>
        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            INFORMATION WE COLLECT
          </h2>
          <p>
            We collect the following categories of information:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>Account Information:</strong> Name, email address, callsign, and login credentials</li>
            <li><strong>Fitness Data:</strong> Workouts, exercises, meals, body metrics, personal records (PRs), weight, and training preferences</li>
            <li><strong>Device & Usage Data:</strong> IP address, browser type, device information, and app usage patterns</li>
            <li><strong>Payment Information:</strong> Processed securely by Stripe; we do not store full card numbers</li>
            <li><strong>Communication Data:</strong> Messages with Gunny AI and trainers</li>
          </ul>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            HOW WE USE YOUR DATA
          </h2>
          <p>
            Your data is used to:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li>Provide and personalize AI-powered fitness coaching through Gunny</li>
            <li>Generate customized workout programs and nutrition recommendations</li>
            <li>Facilitate trainer-client communication and collaboration</li>
            <li>Analyze app usage and improve service features</li>
            <li>Process payments and manage subscriptions</li>
            <li>Send important service updates and announcements</li>
          </ul>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            DATA SHARING
          </h2>
          <p>
            We share your data with:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>Assigned Trainers:</strong> Can view client workout data, metrics, and communication history</li>
            <li><strong>Stripe:</strong> Payment processor (PCI-compliant, secure)</li>
            <li><strong>Anthropic:</strong> Processes AI queries without sending personally identifiable information</li>
            <li><strong>PostHog:</strong> Receives anonymized analytics data to improve the app</li>
          </ul>
          <p>
            We do NOT sell your data to third parties. Data is never shared without your consent except as necessary to provide services.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            DATA SECURITY
          </h2>
          <p>
            We protect your data through:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>Encryption in Transit:</strong> HTTPS/TLS for all data transfers</li>
            <li><strong>Database Encryption:</strong> Encrypted at rest using AES-256</li>
            <li><strong>Password Hashing:</strong> bcrypt with strong salt for password security</li>
            <li><strong>Access Controls:</strong> Role-based permissions limit data exposure</li>
          </ul>
          <p>
            While we implement industry-standard security, no system is completely secure. Notify us immediately of any suspected breaches.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            YOUR PRIVACY RIGHTS
          </h2>
          <p>
            You have the right to:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>Access Your Data:</strong> Request a complete export of your information</li>
            <li><strong>Delete Your Data:</strong> Request permanent deletion of your account and data</li>
            <li><strong>Opt Out of Analytics:</strong> Disable PostHog analytics tracking in account settings</li>
            <li><strong>Manage Trainer Access:</strong> Revoke trainer permissions at any time</li>
          </ul>
          <p>
            To exercise these rights, contact us at privacy@gunsupfitness.com with your request and account ID.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            COOKIES & TRACKING
          </h2>
          <p>
            We use:
          </p>
          <ul style={{ marginLeft: 20, marginTop: 10 }}>
            <li><strong>JWT Tokens:</strong> Stored securely for authentication (no persistent cookies)</li>
            <li><strong>PostHog Analytics:</strong> Anonymized usage tracking without personally identifiable information</li>
            <li><strong>Memory-Only Persistence:</strong> Session data is not persisted to disk for privacy</li>
          </ul>
          <p>
            We do not use third-party advertising cookies or tracking pixels. PostHog analytics can be disabled in account settings.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            CHILDREN'S PRIVACY
          </h2>
          <p>
            GUNS UP FITNESS is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware that a user is under 18, we will delete their account and data immediately.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            POLICY CHANGES
          </h2>
          <p>
            We may update this Privacy Policy. Significant changes will be notified via in-app notification. Your continued use after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section style={{ marginBottom: 30 }}>
          <h2 style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 16,
            color: '#00ff41',
            letterSpacing: 1,
            marginBottom: 12,
            marginTop: 0,
          }}>
            CONTACT
          </h2>
          <p>
            For privacy concerns or to exercise your rights, contact us at <strong>privacy@gunsupfitness.com</strong>
          </p>
        </section>

        <section style={{ marginBottom: 60 }}>
          <p style={{ color: '#888', fontSize: 12, marginTop: 20 }}>
            <strong>Last Updated:</strong> March 2026
          </p>
        </section>
      </div>
    </div>
  );
};
