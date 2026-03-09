import React from 'react';
import useMultiChartStore from '../../store/useMultiChartStore.js';
import MainChart from './MainChart.jsx';

export default function MultiChartLayout() {
    const layoutId = useMultiChartStore(s => s.layoutId);

    if (layoutId === '1') {
        return <MainChart instanceId="main" />;
    }

    if (layoutId === '2v') {
        return (
            <div className="flex flex-col w-full h-full">
                <MainChart instanceId="main" />
                <div className="w-full h-1 bg-tv-border border-y border-black cursor-row-resize shadow-md z-[60]" />
                <MainChart instanceId="chart2" />
            </div>
        );
    }

    if (layoutId === '2h') {
        return (
            <div className="flex flex-row w-full h-full">
                <MainChart instanceId="main" />
                <div className="h-full w-1 bg-tv-border border-x border-black cursor-col-resize shadow-md z-[60]" />
                <MainChart instanceId="chart2" />
            </div>
        );
    }

    if (layoutId === '4') {
        return (
            <div className="flex flex-col w-full h-full">
                <div className="flex flex-row w-full h-1/2">
                    <MainChart instanceId="main" />
                    <div className="h-full w-1 bg-tv-border border-x border-black shadow-md z-[60]" />
                    <MainChart instanceId="chart2" />
                </div>
                <div className="w-full h-1 bg-tv-border border-y border-black shadow-md z-[60]" />
                <div className="flex flex-row w-full h-1/2">
                    <MainChart instanceId="chart3" />
                    <div className="h-full w-1 bg-tv-border border-x border-black shadow-md z-[60]" />
                    <MainChart instanceId="chart4" />
                </div>
            </div>
        );
    }

    return null;
}
