const LOADER_URL = `http://localhost:${process.env.LOADER_PORT}`;


export function initLoadTracker(loadWait) {
    return {
        loadWait: loadWait,
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

export function shouldLoad() {
    return window.loadTracker && !window.loadTracker.mainCompleted;
}

export async function getTokenFromNetwork(App, tokenAddress, stakingAddress, network) {
    switch (network) {
        case window.NETWORKS.ARBITRUM.chainName:
            return await getArbitrumToken(App, tokenAddress, stakingAddress);
        case window.NETWORKS.ETHEREUM.chainName:
            return await getToken(App, tokenAddress, stakingAddress);
    }
}

export function insertVfatInfo(
    app,
    stakingContractAddress,
    stakedTokenAddress,
    stakedUsd,
    stakedTokenPrice,
    stakedTokenTvl,
    rewards = [],
) {
    let loadTracker = window.loadTracker;
    if (loadTracker === 'undefined') {
        console.log('Load Tracker not initialized correctly, unable to insert row');
        return;
    }
    loadTracker.attemptCount += 1;
    const resultPromise = insertVfatInfoAsync(
        app,
        stakingContractAddress,
        stakedTokenAddress,
        stakedUsd,
        stakedTokenPrice,
        stakedTokenTvl,
        rewards,
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

export async function insertVfatInfoAsync(
    app,
    stakingContractAddress,
    stakedTokenAddress,
    stakedUsd,
    stakedTokenPrice,
    stakedTokenTvl,
    rewards = [],
) {
    const networkName = pageNetwork().chainName;
    const stakedToken = await getTokenFromNetwork(app, stakedTokenAddress, stakingContractAddress, networkName);
    const stakedTokenType = window.localStorage.getItem(stakedTokenAddress);
    let currentPath = window.location.pathname;
    currentPath = currentPath.slice(-1) === '/' ? currentPath.slice(0, -1) : currentPath;
    let pageName = currentPath.split('/').pop();

    let completeRewards = [];
    for (const reward of rewards) {
        let token = await getTokenFromNetwork(app, reward.rewardTokenAddress, stakingContractAddress, networkName);
        completeRewards.push({
            rewardTokenAddress: token.address,
            rewardTokenSymbol: token.symbol,
            rewardTokenName: token.name,
            rewardDailyUsd: reward.rewardDailyUsd,
            rewardTokenPrice: reward.rewardTokenPrice,
            apr: reward.apr,
        });
    }
    
    const info_data = {
        networkName: pageNetwork().chainName,
        vfatPageName: pageName,
        stakingContractAddress: stakingContractAddress,
        stakedTokenAddress: stakedTokenAddress,
        stakedTokenSymbol: stakedToken.symbol,
        stakedTokenName: stakedToken.name,
        stakedTokenType: stakedTokenType,
        stakedUsd: stakedUsd,
        stakedTokenPrice: stakedTokenPrice,
        stakedTokenTvl: stakedTokenTvl,
        rewards: completeRewards,
    };
    
    return await fetch(LOADER_URL + '/vfat_infos/create', {
        method: 'POST',
        body: JSON.stringify(info_data),
        headers: {
            'Content-type': 'application/json; charset=UTF-8'
        }
    });
}

export function upgradeCoinGeckoUrl(
    url,
) {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (apiKey === '') {
        return url;
    } else {
        let newUrl = url.replace('api.coingecko.com', 'pro-api.coingecko.com');
        newUrl += `&x_cg_pro_api_key=${apiKey}`;
        return newUrl;
    }
}
