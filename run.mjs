import 'dotenv/config.js';
import { algoliasearch } from 'algoliasearch';

// Function to download all records by browsing the index 
async function browseIndex(cursor = null) {
    console.log('Retrieving all records...');

    // Prepare the request parameters
    const requestOptions = {
        indexName: process.env.INDEX_NAME,
        cursor: cursor,
    };

    // Call the API
    const response = await client.browse(requestOptions);

    // Append the retrieved hits to the allRecords array
    allRecords = allRecords.concat(response.hits);

    // Check if there's a cursor for the next page
    if (response.cursor) {
        console.log('more records to retrieve...');
        // Recursively browse the next page
        await browseIndex(response.cursor);
    } else {
        console.log('no more records to retrieve.');
    }
}

// Function to test
function stripDiviCode(input) {
    let result = "";
    let stack = []; // To track unmatched '['
    let temp = ""; // To hold characters temporarily between '[' and ']'

    for (let char of input) {
        if (char === '[') {
            // Push '[' to stack and flush any accumulated text to result
            stack.push('[');
            temp = ""; // Reset temp as we're starting a new block
        } else if (char === ']') {
            if (stack.length > 0) {
                // Close the most recent '[' block
                stack.pop();
                temp = ""; // Discard accumulated temp as the block is removed
            } else {
                // ']' without a matching '[' - truncate everything before it
                result = "";
            }
        } else {
            if (stack.length > 0) {
                // Accumulate text within '[' and ']'
                temp += char;
            } else {
                // Add text to result if not inside a block
                result += char;
            }
        }
    }

    // If there are unmatched '[' left, discard everything after them
    if (stack.length > 0) {
        result = result.split('[')[0];
    }

    // Remove leading/trailing spaces from the result and return
    return result;
}

// Function to remove <p> tags from a string
function removePTags(inputString) {
    return inputString.replace(/<\/?p>/g, '');
}

// Function to check if a string contains <p> tags
function containsPTags(inputString) {
    const hasOpeningTag = inputString.includes('<p>');
    const hasClosingTag = inputString.includes('</p>');
    return hasOpeningTag || hasClosingTag;
}

// Function to check if a string contains code brackets
function containsCodeBrackets(inputString) {    
    const hasOpeningBracket = inputString.includes('[');
    const hasClosingBracket = inputString.includes(']');
    return hasOpeningBracket || hasClosingBracket;
}

// Function to update records
async function updateRecords(allRecords) {

    console.log('Updating records...');
    for (const record of allRecords) {
        const attributesToUpdate = {};

        // Clean up the post_excerpt if needed
        if (record.post_title && containsPTags(record.post_excerpt)) {
            attributesToUpdate.post_excerpt = removePTags(record.post_excerpt);
        }

        // Clean up the content if needed
        if (record.content && containsCodeBrackets(record.content)) {
            attributesToUpdate.content = stripDiviCode(record.content);
        }

        // Proceed with updating the record if there are changes
        if (Object.keys(attributesToUpdate).length > 0) {
            console.log(`Updating record ${record.id} with changes:`, attributesToUpdate);

            try {
                const { taskID } = await client.partialUpdateObject({
                    indexName: process.env.INDEX_NAME,
                    objectID: record.objectID,
                    attributesToUpdate,
                });
                console.log(`Partial update taskID: ${taskID}`);

                console.log(`Waiting for indexing to complete for record ${record.id}...`);
                // Wait until indexing is complete
                await client.waitForTask({
                    indexName: process.env.INDEX_NAME,
                    taskID,
                });

                console.log(`Record ${record.id} updated successfully.`);
            } catch (error) {
                console.error(`Failed to update record ${record.id}:`, error);
            }
        } else {
            console.log(`No updates required for record ${record.id}.`);
        }
    }
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Download all records and update them sequentially
async function main() {
    try {
        // Step 1: Retrieve all records
        await browseIndex();
        console.log('Total records retrieved:', allRecords.length);

        // Sleep for 5 seconds
        console.log('Waiting for 5 seconds...');
        await sleep(2000);

        // Step 2: Update records
        await updateRecords(allRecords);
        console.log('All records updated successfully!');
    } catch (error) {
        console.error('Error during the main process:', error);
    }
}

// Initialize the client
const client = algoliasearch(process.env.ALGOLIA_APPLICATION_ID, process.env.ALGOLIA_API_KEY);
console.log('Client initialized successfully.');

// Initialize an empty array to store all records
let allRecords = [];

// Run the main process
main();