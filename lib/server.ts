// This file is for compatibility with Vercel's deployment.

import { initHealthKit } from '@/healthkit';
import '@/utils/request-rewriter';

// Initialize HealthKit for Vercel deployment
initHealthKit();

export { default } from './app-bootstrap';
