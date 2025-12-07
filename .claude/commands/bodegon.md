---
allowed-tools: TodoWrite, mcp__playwright__browser_navigate, mcp__playwright__browser_click, mcp__playwright__browser_take_screenshot, mcp__plugin_claude-nanobanana_nanobanana__remix_image
argument-hint: [url] [remix_prompt]
description: Automated web scraping and bodegón creation workflow
---

# Web Scrape & Create Bodegón

Automated workflow to scrape product images from a website and create an artistic bodegón composition.

## Parameters
- **URL**: $1 - The website URL to scrape product images from
- **Remix Prompt**: $2 - The artistic prompt for creating the bodegón composition

## Process

### 1. Setup and Navigation
Navigate to the specified URL and identify product elements on the page.

### 2. Image Capture Strategy
Based on the best practices from prompt engineering documentation:
- **Be explicit with instructions**: Clearly define which images to capture
- **Add context for better performance**: Explain the goal behind each action
- **Use structured approach**: Break down complex tasks into manageable steps
- **Maintain state tracking**: Keep track of progress throughout the workflow

### 3. Image Collection Workflow
1. Navigate to target URL ($1)
2. Identify product images/links using Playwright MCP
3. Click on first product link
4. Navigate through product image gallery (3 images)
5. Take screenshots of each product image
6. Save images with systematic naming convention

### 4. Artistic Composition
Create a bodegón using the NanoBanana MCP with:
- Collected product images as input
- User-provided remix prompt ($2) for artistic direction
- Focus on creating contemporary still-life composition

## Implementation Guidelines

### Context Management
- Use TodoWrite tool for progress tracking across multiple steps
- Maintain clear state of each captured image
- Follow incremental progress approach

### Tool Usage Patterns
- Execute browser actions sequentially with clear purpose
- Use parallel tool calling when operations can be done simultaneously
- Implement structured error handling and validation

### Quality Assurance
- Verify each image capture before proceeding
- Ensure consistent image quality and composition
- Validate final bodegón output meets artistic requirements

## Expected Output
1. **Individual product images**: 3 high-quality screenshots saved to `.playwright-mcp/`
2. **Artistic bodegón**: Single composition saved to `nanobanana-output/`
3. **Progress tracking**: Complete todo list showing all completed steps

## Usage Example
```
/bodegon "https://www.exito.com/tecnologia/consolas-y-videojuegos" "Create an elegant bodegón composition showcasing these technology products as contemporary art pieces with dramatic lighting"
```

## Context Awareness
This command leverages Claude 4.5's improved capabilities:
- **Long-horizon reasoning**: Maintains orientation across extended workflow
- **Tool usage precision**: Uses specific tools with explicit instructions
- **State management**: Tracks progress systematically across multiple steps