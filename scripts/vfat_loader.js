import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
const concurrently = require('concurrently');
const puppeteer = require('puppeteer');
const { ArgumentParser } = require('argparse');
const { PrismaClient } = require('@prisma/client');


dotenv.config();

const VFAT_URI = `http://localhost:${process.env.VFAT_PORT}`;
const PROTOCOLS = [
    'sushiv2',
    'alcx',
];

const argParser = new ArgumentParser();
const prisma = new PrismaClient();

argParser.add_argument('-t', '--test', { action: 'store_true', default: false, help: 'run in test mode, batch id is set to -1' });
argParser.add_argument('-p', '--protocols', { default: null, help: `comma separated list of protocols from: ${PROTOCOLS.join(',')}`, type: 'str'});

(async function main(){
    let args = argParser.parse_args();
    let batch_id;
    const isTest = args.test;
    let selectedProtocols = PROTOCOLS;
    if (args.protocols) {
        selectedProtocols = args.protocols.split(',');
    }
    
    if (!isTest) {
        try {
            const createBatch = await prisma.vfat_batches.create({ data: {} });
            batch_id = createBatch.batch_id;
            console.log(`Running in production mode, new batch created with id: ${batch_id}`);
        } catch (error) {
            console.error(`Failed to create vfat_batch instance with error: ${error}`);
            throw error;
        }
    } else {
        console.log(`Running in test mode, no batch created using batch_id: -1`);
        batch_id = -1;
    }

    const buildCommand = concurrently(
        [{ command: 'NODE_ENV=development npm-run-all --sequential rmprod copy-to-dist build:*', name: 'build' }],
        {outputStream: fs.createWriteStream('/dev/null')},
    );
    
    console.log('Building...');
    try {
        const closeEvents = await buildCommand.result;
        console.log(`Build completed in ${closeEvents[0].timings.durationSeconds.toFixed(2)} seconds`);
    } catch (closeEvents) {
        console.error(`Build failed with error: ${closeEvents[0].command.error}`);
        throw closeEvents[0].command.error;
    }
 
    const serverCommands = concurrently(
        [
            { command: `npm run start -- --port=${process.env.VFAT_PORT}`, name: 'vfat' },
            { command: `npm run prisma-server -- --batch=${batch_id}`, name: 'prisma-server' },
        ],
        { killOthers: ['success', 'failure'] }
    );
    
    serverCommands.result.then(closeEvents => {
        console.error(`Process ${closeEvents[0].command.name} unexpectedly terminated`);
        throw `${closeEvents[0].command.name} unexpectedly completed`;
    }, closeEvents => {
        for (const closeEvent of closeEvents) {
            if (closeEvent.killed) {
                console.log(`Process ${closeEvent.command.name} stopped`);
            } else {
                console.error(`Process ${closeEvent.command.name} failed`);
                throw `${closeEvents[0].command.name} unexpectedly failed`;
            }
        }
    });
    
    const browser = await puppeteer.launch({ headless: !isTest });
    const page = await browser.newPage();

    for (const protocol of selectedProtocols) {
        try {
            console.log(`Loading protocol page ${protocol}`);
            const url = `${VFAT_URI}/${protocol}`;
            await page.goto(url, {waitUntil: 'load', timeout: 60000});
            try {
                await page.waitForFunction('window.hasOwnProperty(\'loadTracker\') === true', {timeout: 5000});
            } catch (e) {
                console.log(`Protocol '${protocol}' not initialized correctly, skipping to next`);
                continue;
            }
            await page.waitForFunction('window.loadTracker.loadCompleted === true', {timeout: 60000});
            const successCount = await page.evaluate('window.loadTracker.successCount');
            const attemptCount = await page.evaluate('window.loadTracker.attemptCount');
            console.log(`Successfully loaded ${protocol}, ${successCount} / ${attemptCount} objects loaded`);
        } catch (error) {
            console.error(error);
        }
    }
    console.log('Completed loading')
    await browser.close();
    
    for (const command of serverCommands.commands) {
        command.kill('SIGINT');
    }
})();
