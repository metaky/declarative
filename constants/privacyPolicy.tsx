import React from 'react';

export const PRIVACY_POLICY_CONTENT = (
    <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">
        <p><strong>Last Updated:</strong> March 4, 2026</p>

        <p>
            Welcome to Declarative. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
        </p>

        <h2>1. Information We Collect</h2>
        <p>
            We collect information about you in the following ways when you use the Application:
        </p>
        <h3>AI Translation (Google Gemini)</h3>
        <p>
            The text you enter into the input box is sent to Google's Gemini API to generate declarative translation suggestions. For details on how Google processes and protects this data, please see the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">Google Gemini API Terms of Service</a>.
        </p>
        <h3>Analytics and Session Recordings (PostHog)</h3>
        <p>
            We collect anonymous usage analytics via PostHog (such as page views, clicks, and feature usage via autocapture) plus session recordings that show on-screen content, including the AI-generated translation suggestions. Text typed into the input box is masked and is not visible in recordings. We collect this data for the purpose of understanding usage and improving translation quality. Users are anonymous (no accounts are created or required). The data collected includes:
        </p>
        <ul>
            <li><strong>Usage Analytics:</strong> Anonymous information about your interactions with the app, such as the features you use, buttons you click, and pages you view via autocapture.</li>
            <li><strong>Session Recordings:</strong> Visual replays of on-screen user interface interactions and generated translation suggestions. Any text typed into the input box is masked and is not visible in recordings.</li>
            <li><strong>Device Information:</strong> Basic device and browser information (such as browser type and operating system) to help troubleshoot technical issues.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>
            Having accurate information permits us to provide you with a smooth, efficient, and customized experience. Specifically, we use information collected to:
        </p>
        <ul>
            <li>Generate declarative translation suggestions via Google's Gemini API.</li>
            <li>Understand usage patterns and improve translation quality.</li>
            <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
            <li>Identify and troubleshoot bugs and errors.</li>
        </ul>

        <h2>3. Disclosure of Your Information</h2>
        <p>
            We do not sell your information. We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
        </p>
        <ul>
            <li>
                <strong>Third-Party Service Providers:</strong> We share information with third-party service providers that enable core application functionality and analytics:
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Google Gemini API:</strong> The text you enter into the input box is sent to Google's Gemini API to generate translation suggestions. Please see the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">Google Gemini API Terms of Service</a> for data-use details.</li>
                    <li><strong>PostHog:</strong> We share anonymous usage analytics and session recordings with PostHog to analyze how the app is used. PostHog's use of your information is governed by their privacy policy.</li>
                </ul>
            </li>
            <li>
                <strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
            </li>
        </ul>

        <h2>4. Your Data Protection Rights (GDPR and CCPA)</h2>
        <p>
            Depending on your location, you may have the following rights regarding your personal data:
        </p>
        <ul>
            <li><strong>The right to access</strong> – You have the right to request copies of your personal data.</li>
            <li><strong>The right to rectification</strong> – You have the right to request that we correct any information you believe is inaccurate or complete information you believe is incomplete.</li>
            <li><strong>The right to erasure</strong> – You have the right to request that we erase your personal data, under certain conditions.</li>
            <li><strong>The right to restrict processing</strong> – You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
            <li><strong>The right to data portability</strong> – You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.</li>
            <li><strong>The right to opt-out</strong> - PostHog respects "Do Not Track" browser settings. You can also opt-out of PostHog tracking on this site by enabling it.</li>
        </ul>
        <p>To exercise these rights, please contact us at the email address below.</p>


        <h2>5. Children's Privacy</h2>
        <p>
            This application is intended for use by parents and caregivers. We do not knowingly collect any information from children under the age of 13. If you believe we have inadvertently collected such information, please contact us so we can promptly obtain parental consent or remove the information.
        </p>

        <h2>6. Changes to This Privacy Policy</h2>
        <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the application. You are advised to review this Privacy Policy periodically for any changes.
        </p>

        <h2>7. Contact Us</h2>
        <p>
            If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:declarativeapp@gmail.com" className="text-sky-600 underline">declarativeapp@gmail.com</a>
        </p>
    </div>
);
