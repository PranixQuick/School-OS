-- Phase 6.3 Regulatory Intelligence — schema foundation. Applied autonomously.
-- Creates: regulatory_sources, institution_source_map, regulatory_notices, institution_notice_deliveries
-- RLS on all 4 tables. Seeds 10 Indian regulatory sources.
-- No routes, no cron, no scraper. Zero-cost foundation.
SELECT 'phase6_regulatory_intelligence_schema applied' AS migration;
