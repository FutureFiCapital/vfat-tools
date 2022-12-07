const express = require('express');
const cors = require('cors');
const { ArgumentParser } = require('argparse');
const { PrismaClient } = require('@prisma/client');

const argParser = new ArgumentParser();
argParser.add_argument('-p', '--port', { type: 'int', default: 3002, help: 'Port to run the server' });
argParser.add_argument('-b', '--batch', { type: 'int', default: -1, help: 'Batch ID associated with objects' });
let args = argParser.parse_args();

const app = express();

app.use(cors());
app.options('*', cors());
app.use(express.json());

const prisma = new PrismaClient();

app.get('/', (req, res) => {
    res.send('Hello World!')
});

app.listen(args.port, () => {
    console.log(`Loader listening on port ${args.port}`)
});


function hexToBuffer(str) {
    if (typeof str == 'undefined') {
        throw 'Attempting to convert undefined string to buffer';
    }
    return Buffer.from(str.substring(2), 'hex');
}

// TODO: Add endpoint for vfat_rewards

app.post('/vfat_infos/create', async(req, res) => {
    try {
        const insert_data = {
            vfat_batch: { connect: { batch_id: args.batch }},
            staked_token: { connectOrCreate: {
                    where: { token_address: hexToBuffer(req.body.stakedTokenAddress) },
                    create: {
                        token_address: hexToBuffer(req.body.stakedTokenAddress),
                        symbol: req.body.stakedTokenSymbol,
                        name: req.body.stakedTokenName,
                    }
                }},
            staking_contract_address: hexToBuffer(req.body.stakingContractAddress),
            staked_usd: req.body.stakedUsd,
            staked_token_price: req.body.stakedTokenPrice,
            staked_token_tvl: req.body.stakedTokenTvl,
            
            pool_address:  typeof req.body?.poolAddress === 'string' ? hexToBuffer(req.body.poolAddress) : null,

            vfat_rewards: { create: req.body.rewards.map(reward => ({
                reward_token: { connectOrCreate: {
                        where: { token_address: hexToBuffer(reward.rewardTokenAddress) },
                        create: {
                            token_address: hexToBuffer(reward.rewardTokenAddress),
                            symbol: reward.rewardTokenSymbol,
                            name: reward.rewardTokenName,
                        }
                    }},
                reward_daily_usd: reward.rewardDailyUsd,
                reward_token_price: reward.rewardTokenPrice,
                apr: reward.apr,
            }))}
        };
        
        const result = await prisma.vfat_infos.create({
            data: insert_data, 
            include: {
                vfat_rewards: true,
            }
        });
        console.log(`Created vfat_info: ${result.info_id}, ${req.body.rewards.length} rewards added`);
        return res.send('Created vfat_info');
    } catch (error) {
        console.warn(`Failed to create vfat_info: ${error}`);
        return res.status(500).send('Failed to create vfat_info');
    }
});
