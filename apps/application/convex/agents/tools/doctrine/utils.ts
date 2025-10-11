"use node"

import FireCrawl from "@mendable/firecrawl-js";
import { internalAction } from "../../../_generated/server";
import { v } from "convex/values";

const firecrawl = new FireCrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});


const SITES_ENABLED = [
    "https://www.saij.gob.ar/",
    "https://www.pensamientopenal.com.ar/doctrina/",
]


export const searchDoctrine = internalAction({
    args: {
        query: v.string(),
    },
    returns: v.array(v.any()),
    handler: async (ctx, args) => {
        const searchPromises = SITES_ENABLED.map(async (site) => {
            const result = await firecrawl.search(`site:${site} ${args.query}`);
            return result;
        });
        const results = await Promise.all(searchPromises);
        return results;
    }
})


export const crawlUrl = internalAction({
    args: {
        url: v.string(),
    },
    returns: v.array(v.string()),
    handler: async (ctx, args) => {
        // Use markdown format instead of HTML - Firecrawl automatically extracts main content
        const result = await firecrawl.crawl(args.url, {
            scrapeOptions: {
                formats: ["markdown", "html"],
                onlyMainContent: true, // This tells Firecrawl to extract only main content
                excludeTags: ['nav', 'footer', 'header', 'aside', 'form'], // Exclude common non-content elements
            }
        });
        return result.data.map(doc => {
            // Prefer markdown, fallback to cleaned HTML if needed
            if (doc.markdown) {
                return formatContent(doc);
            }
            return doc.html ? simpleHtmlClean(doc.html) : "";
        });
    }
})

/**
 * Format extracted content with metadata
 */
const formatContent = (doc: any): string => {
    const parts = [];
    
    if (doc.metadata?.title) {
        parts.push(`Title: ${doc.metadata.title}`);
    }
    if (doc.metadata?.author) {
        parts.push(`Author: ${doc.metadata.author}`);
    }
    if (doc.metadata?.description) {
        parts.push(`Description: ${doc.metadata.description}`);
    }
    if (parts.length > 0) {
        parts.push(""); // Add blank line
    }
    
    parts.push(doc.markdown || doc.html || "");
    
    return parts.join("\n");
}

/**
 * Simple HTML tag stripper as fallback (no DOM parsing needed)
 */
const simpleHtmlClean = (html: string): string => {
    return html
        // Remove script and style tags and their content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}


