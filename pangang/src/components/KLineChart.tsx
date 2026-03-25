"use client";

import { useEffect, useRef, useMemo } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';

interface KLineData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

interface MAData {
    time: number;
    value: number;
}

interface IndicatorData {
    time: number;
    value: number;
}

interface HistogramData {
    time: number;
    value: number;
    color?: string;
}

interface Marker {
    time: number;
    position: 'aboveBar' | 'belowBar' | 'inBar';
    color: string;
    shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
    text: string;
}

interface KLineChartProps {
    data: KLineData[];
    markers?: Marker[];
    height?: number;
    interval?: string;
    showMA?: boolean;
    showVolume?: boolean;
    showRSI?: boolean;
    showMACD?: boolean;
    maPeriods?: number[];
}

export default function KLineChart({
    data,
    markers = [],
    height = 400,
    interval = '1H',
    showMA = true,
    showVolume = true,
    showRSI = false,
    showMACD = false,
    maPeriods = [5, 10, 20, 60]
}: KLineChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any | null>(null);
    const seriesRef = useRef<any>({});

    // 计算移动平均线
    const maData = useMemo(() => {
        if (!data || data.length === 0) return {};
        const result: Record<number, MAData[]> = {};
        maPeriods.forEach(period => { result[period] = []; });

        data.forEach((candle, i) => {
            maPeriods.forEach(period => {
                if (i >= period - 1) {
                    const sum = data.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
                    result[period].push({ time: candle.time, value: sum / period });
                }
            });
        });
        return result;
    }, [data, maPeriods]);

    // 计算 RSI
    const rsiData = useMemo(() => {
        if (!data || data.length < 14) return [];
        const period = 14;
        const result: IndicatorData[] = [];
        let gains = 0;
        let losses = 0;

        // 计算初始平均涨跌幅
        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i - 1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            result.push({ time: data[i].time, value: rsi });
        }
        return result;
    }, [data]);

    // 计算 MACD
    const macdData = useMemo(() => {
        if (!data || data.length < 26) return { macd: [], signal: [], histogram: [] };

        const ema = (arr: number[], period: number): number[] => {
            const k = 2 / (period + 1);
            const result: number[] = [arr[0]];
            for (let i = 1; i < arr.length; i++) {
                result.push(arr[i] * k + result[i - 1] * (1 - k));
            }
            return result;
        };

        const closes = data.map(d => d.close);
        const ema12 = ema(closes, 12);
        const ema26 = ema(closes, 26);
        const macdLine = ema12.map((v, i) => v - ema26[i]);

        const signalLine = ema(macdLine, 9);
        const histogram = macdLine.map((v, i) => v - signalLine[i]);

        const result = {
            macd: macdLine.slice(26).map((v, i) => ({ time: data[i + 26].time, value: v })),
            signal: signalLine.slice(26).map((v, i) => ({ time: data[i + 26].time, value: v })),
            histogram: histogram.slice(26).map((v, i) => ({
                time: data[i + 26].time,
                value: v,
                color: v >= 0 ? 'rgba(38, 166, 154, 0.8)' : 'rgba(239, 83, 80, 0.8)'
            }))
        };
        return result;
    }, [data]);

    // MA 颜色配置
    const maColors: Record<number, string> = {
        5: '#FF6B6B',
        10: '#4ECDC4',
        20: '#45B7D1',
        60: '#96CEB4',
    };

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 计算主图和副图高度
        let mainHeight = height;
        const volumeHeight = showVolume ? 80 : 0;
        const rsiHeight = showRSI ? 80 : 0;
        const macdHeight = showMACD ? 80 : 0;

        if (showRSI || showMACD) {
            mainHeight = height - (rsiHeight + macdHeight);
        }

        // 1. Create Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111' },
                textColor: '#DDD',
            },
            grid: {
                vertLines: { color: '#222' },
                horzLines: { color: '#222' },
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                borderColor: '#444',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#444',
            },
        });

        chartRef.current = chart;
        seriesRef.current = {};

        // 2. Add Candlestick Series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        seriesRef.current.candle = candleSeries;

        // 3. 添加成交量副图
        if (showVolume && data && data.length > 0) {
            const volumeData = data.map(d => ({
                time: d.time,
                value: d.volume || 0,
                color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            }));

            const volumeSeries = chart.addSeries(HistogramSeries, {
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume',
            });
            volumeSeries.setData(volumeData as any);

            chart.priceScale('volume').applyOptions({
                scaleMargins: { top: 0.85 - (rsiHeight + macdHeight) / height, bottom: 0 },
            });
            seriesRef.current.volume = volumeSeries;
        }

        // 4. 添加移动平均线
        if (showMA) {
            maPeriods.forEach(period => {
                const maSeries = chart.addSeries(LineSeries, {
                    color: maColors[period] || '#FFF',
                    lineWidth: 1,
                    priceLineVisible: false,
                    crosshairMarkerVisible: false,
                });
                if (maData[period]) {
                    maSeries.setData(maData[period] as any);
                }
                seriesRef.current[`ma${period}`] = maSeries;
            });
        }

        // 5. 添加 RSI 副图
        if (showRSI && rsiData.length > 0) {
            const rsiSeries = chart.addSeries(LineSeries, {
                color: '#9B59B6',
                lineWidth: 2,
                priceLineVisible: false,
                priceScaleId: 'rsi',
            });
            rsiSeries.setData(rsiData as any);

            chart.priceScale('rsi').applyOptions({
                scaleMargins: { top: 0.75, bottom: 0.15 },
                borderColor: '#444',
            });
            seriesRef.current.rsi = rsiSeries;
        }

        // 6. 添加 MACD 副图
        if (showMACD && macdData.macd.length > 0) {
            const macdSeries = chart.addSeries(HistogramSeries, {
                priceScaleId: 'macd',
            });
            macdSeries.setData(macdData.histogram as any);

            const signalSeries = chart.addSeries(LineSeries, {
                color: '#FFA500',
                lineWidth: 1,
                priceLineVisible: false,
                priceScaleId: 'macd',
            });
            signalSeries.setData(macdData.signal as any);

            chart.priceScale('macd').applyOptions({
                scaleMargins: { top: 0.85, bottom: 0 },
                borderColor: '#444',
            });
            seriesRef.current.macd = macdSeries;
        }

        // 7. Set K线 Data
        if (data && data.length > 0) {
            candleSeries.setData(data as any);
        }

        // 8. Add Markers
        if (markers && markers.length > 0) {
            createSeriesMarkers(candleSeries, markers as any);
        }

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, markers, height, interval, showMA, showVolume, showRSI, showMACD, maPeriods, maData, rsiData, macdData]);

    return (
        <div ref={chartContainerRef} className="w-full relative group">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none">
                <span className="text-xs text-gray-400">BTC/USDT {interval}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">OKX 永续</span>
            </div>
        </div>
    );
}
