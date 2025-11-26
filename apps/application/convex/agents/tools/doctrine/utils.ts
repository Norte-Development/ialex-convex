"use node"

import FireCrawl from "@mendable/firecrawl-js";
import { internalAction } from "../../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../../_generated/api";

/**
 * FireCrawl client instance for web scraping and search operations.
 * Requires FIRECRAWL_API_KEY environment variable to be set.
 */
const firecrawl = new FireCrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});


/**
 * Searches for doctrine across enabled legal database sites.
 * 
 * This action performs parallel searches across all authorized doctrine sources
 * and returns aggregated results.
 * 
 * @param query - The search query string to find relevant doctrine
 * @returns Array of search results from all enabled sites
 * 
 * @throws {Error} If the API key is not configured
 * @throws {Error} If the query is empty or invalid
 * @throws {Error} If all search requests fail
 * 
 * @example
 * ```typescript
 * const results = await ctx.runAction(internal.agents.tools.doctrine.utils.searchDoctrine, {
 *   query: "derecho penal"
 * });
 * ```
 */
export const searchDoctrine = internalAction({
    args: {
        query: v.string(),
        userId: v.id("users"),
    },
    returns: v.array(v.any()),
    handler: async (ctx, args) => {
        try {
            // Validate API key
            if (!process.env.FIRECRAWL_API_KEY) {
                throw new Error("FIRECRAWL_API_KEY environment variable is not set");
            }

            // Validate query
            if (!args.query || args.query.trim().length === 0) {
                throw new Error("Search query cannot be empty");
            }

            const searchQuery = args.query.trim();

            const doctrineSearchSites: string[] = await ctx.runQuery(internal.functions.users.getDoctrineSearchSites, {
                userId: args.userId
            });

            // Execute parallel searches with error handling for each
            const searchPromises = doctrineSearchSites.map(async (site) => {
                try {
                    const result = await firecrawl.search(`site:${site} ${searchQuery}`);
                    return result;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error";
                    console.error(`Search failed for ${site}:`, errorMessage);
                    // Return empty result for this site instead of failing completely
                    return { web: [] };
                }
            });

            const results = await Promise.all(searchPromises);

            // Check if all searches failed
            const hasAnyResults = results.some(r => r && r.web && r.web.length > 0);
            if (!hasAnyResults) {
                console.warn(`No doctrine results found for query: ${searchQuery}`);
            }

            return results;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            console.error("Error searching doctrine:", errorMessage);
            throw new Error(`Failed to search doctrine: ${errorMessage}`);
        }
    }
})


/**
 * Crawls a URL and extracts its content in a structured format.
 * 
 * This action uses FireCrawl to scrape web pages and extract their main content,
 * automatically removing navigation, headers, footers, and other non-content elements.
 * 
 * @param url - The URL to crawl and extract content from
 * @returns Array of extracted content strings with metadata
 * 
 * @throws {Error} If the API key is not configured
 * @throws {Error} If the URL is invalid or inaccessible
 * @throws {Error} If the crawl operation fails
 * 
 * @remarks
 * - Prefers markdown format for cleaner content extraction
 * - Falls back to HTML with basic cleaning if markdown is unavailable
 * - Includes metadata (title, author, description) when available
 * - Excludes navigation, forms, headers, footers, and aside elements
 * 
 * @example
 * ```typescript
 * const content = await ctx.runAction(internal.agents.tools.doctrine.utils.crawlUrl, {
 *   url: "https://www.saij.gob.ar/some-article"
 * });
 * ```
 */
export const crawlUrl = internalAction({
    args: {
        url: v.string(),
    },
    returns: v.array(v.string()),
    handler: async (ctx, args) => {
        try {
            // Validate API key
            if (!process.env.FIRECRAWL_API_KEY) {
                throw new Error("FIRECRAWL_API_KEY environment variable is not set");
            }

            // Validate URL
            if (!args.url || args.url.trim().length === 0) {
                throw new Error("URL cannot be empty");
            }

            // Validate URL format
            try {
                new URL(args.url);
            } catch (urlError) {
                throw new Error(`Invalid URL format: ${args.url}`);
            }

            // Use markdown format instead of HTML - Firecrawl automatically extracts main content
            const result = await firecrawl.crawl(args.url, {
                scrapeOptions: {
                    formats: ["markdown", "html"],
                    onlyMainContent: true, // This tells Firecrawl to extract only main content
                    excludeTags: ['nav', 'footer', 'header', 'aside', 'form'], // Exclude common non-content elements
                }
            });

            // Validate crawl result
            if (!result || !result.data || !Array.isArray(result.data)) {
                throw new Error(`Invalid crawl response for URL: ${args.url}`);
            }

            if (result.data.length === 0) {
                throw new Error(`No content found at URL: ${args.url}`);
            }

            // Process and format each document
            const processedContent = result.data.map(doc => {
                try {
                    // Prefer markdown, fallback to cleaned HTML if needed
                    if (doc.markdown) {
                        return formatContent(doc);
                    }
                    if (doc.html) {
                        return simpleHtmlClean(doc.html);
                    }
                    return "";
                } catch (error) {
                    console.error("Error processing document:", error);
                    return "";
                }
            }).filter(content => content.length > 0); // Remove empty strings

            if (processedContent.length === 0) {
                throw new Error(`Could not extract content from URL: ${args.url}`);
            }

            return processedContent;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
            console.error("Error crawling URL:", errorMessage);
            throw new Error(`Failed to crawl URL: ${errorMessage}`);
        }
    }
})

/**
 * Formats extracted content with structured metadata.
 * 
 * Creates a human-readable format by prepending metadata (title, author, description)
 * to the main content. This helps provide context about the doctrine source.
 * 
 * @param doc - The document object containing markdown/html content and metadata
 * @returns Formatted string with metadata header and content
 * 
 * @remarks
 * - Extracts title, author, and description from metadata when available
 * - Adds a blank line between metadata and content for readability
 * - Handles missing metadata gracefully
 * 
 * @example
 * ```typescript
 * const formatted = formatContent({
 *   markdown: "# Content here",
 *   metadata: { title: "Article Title", author: "John Doe" }
 * });
 * // Returns:
 * // Title: Article Title
 * // Author: John Doe
 * //
 * // # Content here
 * ```
 */
const formatContent = (doc: any): string => {
    try {
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
        
        const content = doc.markdown || doc.html || "";
        parts.push(content);
        
        return parts.join("\n");
    } catch (error) {
        console.error("Error formatting content:", error);
        // Return raw content as fallback
        return doc.markdown || doc.html || "";
    }
}

/**
 * Strips HTML tags and cleans up HTML content.
 * 
 * This is a lightweight fallback function for cleaning HTML when markdown
 * extraction is not available. It removes all HTML tags and normalizes whitespace.
 * 
 * @param html - The HTML string to clean
 * @returns Plain text with HTML tags removed and entities decoded
 * 
 * @remarks
 * - Removes script and style tags completely (including their content)
 * - Strips all remaining HTML tags
 * - Decodes common HTML entities (&nbsp;, &amp;, etc.)
 * - Normalizes whitespace (multiple spaces/newlines become single space)
 * - Does not use DOM parsing (works in Node.js environment)
 * 
 * @example
 * ```typescript
 * const cleaned = simpleHtmlClean("<div>Hello&nbsp;<b>World</b></div>");
 * // Returns: "Hello World"
 * ```
 */
const simpleHtmlClean = (html: string): string => {
    try {
        if (!html || typeof html !== 'string') {
            return "";
        }

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
            .replace(/&#39;/g, "'")
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    } catch (error) {
        console.error("Error cleaning HTML:", error);
        return "";
    }
}


