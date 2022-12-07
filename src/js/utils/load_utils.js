const LOADER_URL = `http://localhost:${process.env.LOADER_PORT}`;


export function initLoadTracker() {
    return {
        mainCompleted: false,
        loadCompleted: false,
        attemptCount: 0,
        successCount: 0,
        resultPromises: [],
        results: [],
        async completeLoad() {
            this.mainCompleted = true;
            this.results = await Promise.allSettled(this.resultPromises);
            this.loadCompleted = true;
        },
    };
}

export function insertVfatInfoRaw(
    loadTracker,
    stakingContractAddress,
    stakedTokenAddress,
    stakedTokenSymbol,
    stakedTokenName,
    stakedUsd,
    stakedTokenPrice,
    stakedTokenTvl,
    rewards = [],
    poolAddress = null,
) {
    loadTracker.attemptCount += 1;
    const resultPromise = insertVfatInfoRawAsync(
        stakingContractAddress,
        stakedTokenAddress,
        stakedTokenSymbol,
        stakedTokenName,
        stakedUsd,
        stakedTokenPrice,
        stakedTokenTvl,
        rewards,
        poolAddress = null,
    ).then(
        response => {
            if (!response.ok) {
                throw response;
            }
            loadTracker.successCount += 1;
            return response;
        }
    ).catch(error => {
            console.log(`Failed to insert vfat: ${error}`);
            return null;
        }
    );
    loadTracker.resultPromises.push(resultPromise);
}

export async function insertVfatInfoRawAsync(
    stakingContractAddress,
    stakedTokenAddress,
    stakedTokenSymbol,
    stakedTokenName,
    stakedUsd,
    stakedTokenPrice,
    stakedTokenTvl,
    rewards = [],
    poolAddress = null,
) {
    const info_data = {
        stakingContractAddress: await stakingContractAddress,
        poolAddress: await poolAddress,
        stakedTokenAddress: await stakedTokenAddress,
        stakedTokenSymbol: await stakedTokenSymbol,
        stakedTokenName: await stakedTokenName,
        stakedUsd: await stakedUsd,
        stakedTokenPrice: await stakedTokenPrice,
        stakedTokenTvl: await stakedTokenTvl,
        rewards: rewards,
    };
    
    return await fetch(LOADER_URL + '/vfat_infos/create', {
        method: 'POST',
        body: JSON.stringify(info_data),
        headers: {
            'Content-type': 'application/json; charset=UTF-8'
        }
    });
}

export function insertVfatInfo(
    loadTracker,
    stakingContractAddress,
    poolInfo,
    poolPrices,
    rewards = [],
    poolAddress = null,
) {
    insertVfatInfoRaw(
        loadTracker,
        stakingContractAddress,
        poolInfo.poolToken.address,
        poolInfo.poolToken.symbol,
        poolPrices.stakeTokenTicker,
        poolPrices.staked_tvl,
        poolPrices.price,
        poolPrices.tvl,
        rewards,
        poolAddress || poolInfo?.address,
    );
}

export async function buildVfatReward(
    rewardTokenAddress,
    rewardTokenSymbol,
    rewardTokenName,
    rewardDailyUsd,
    rewardTokenPrice,
    apr,
) {
    return {
        rewardTokenAddress: rewardTokenAddress,
        rewardTokenSymbol: rewardTokenSymbol,
        rewardTokenName: rewardTokenName,
        rewardDailyUsd: rewardDailyUsd,
        rewardTokenPrice: rewardTokenPrice,
        apr: apr,
    }
}


export async function insertVfatInfoSingleReward(
    contractAddress,
    poolInfo,
    poolPrices,
) {
    const rewardData = {
        rewardTokenAddress: poolInfo.rewarderToken.rewardTokenAddress,
        rewardTokenSymbol: poolInfo.rewarderToken.symbol,
        rewardTokenName: poolInfo.rewarderToken.name,  
    };
    const info_data = {
        contractAddress: contractAddress,
        stakedTokenAddress: poolInfo.poolToken.address,
        stakedTokenSymbol: poolInfo.poolToken.symbol,
        stakedTokenName: poolPrices.stakeTokenTicker,
        stakedUsd: poolPrices.staked_tvl,
        stakedTokenPrice: poolPrices.price,
        stakedTokenTvl: poolPrices.tvl,
        rewards: rewards,
    };
    
    return await fetch(LOADER_URL + '/vfat_infos/create', {
        method: 'POST',
        body: JSON.stringify(info_data),
        headers: {
            'Content-type': 'application/json; charset=UTF-8'
        }
    });
}
