// This file is for compatibility with Vercel's deployment.

import '@/utils/request-rewriter';

import { initHealthKit } from '@/healthkit';

// Initialize HealthKit for Vercel deployment
initHealthKit();

export { default } from './app-bootstrap';
