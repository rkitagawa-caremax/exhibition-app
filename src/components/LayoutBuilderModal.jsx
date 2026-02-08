import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, Plus, Settings, Save, Eye, Download, Box, Square, ArrowRight,
    Edit3, Trash2, LayoutGrid, Users, XCircle, LayoutDashboard
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const extractNum = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const halfVal = val.toString().replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const match = halfVal.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

export default function LayoutBuilderModal({ onClose, currentLayout, onSave, exhibition, enterprises: propEnterprises }) {
    const enterprises = propEnterprises || exhibition.enterprises || [];
    // ============================================================================
    // 会場設定（メートル単位）
    // ============================================================================
    const savedSettings = currentLayout?.settings || {};
    const [venueWidth, setVenueWidth] = useState(savedSettings.venueWidth || 20);
    const [venueHeight, setVenueHeight] = useState(savedSettings.venueHeight || 15);
    const [defaultBoothWidth, setDefaultBoothWidth] = useState(savedSettings.boothWidth || 2.5);
    const [defaultBoothHeight, setDefaultBoothHeight] = useState(savedSettings.boothHeight || 2.5);
    const [pixelsPerMeter, setPixelsPerMeter] = useState(savedSettings.scale || 40);
    const [zoomScale, setZoomScale] = useState(1);

    // 自動配置設定
    const [aisleWidth, setAisleWidth] = useState(savedSettings.aisleWidth || 2);
    const [allowBackToBack, setAllowBackToBack] = useState(savedSettings.allowBackToBack !== false);

    // キャンバスサイズを動的計算 (ワークスペースはメインエリアの4倍)
    const mainAreaWidth = venueWidth * pixelsPerMeter;
    const mainAreaHeight = venueHeight * pixelsPerMeter;
    const canvasWidth = mainAreaWidth * 4;
    const canvasHeight = mainAreaHeight * 4;
    const mainAreaOffsetX = (canvasWidth - mainAreaWidth) / 2;
    const mainAreaOffsetY = (canvasHeight - mainAreaHeight) / 2;

    // ============================================================================
    // アイテム管理
    // ============================================================================
    const [items, setItems] = useState(currentLayout?.items || []);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isDirty, setIsDirty] = useState(false); // 未保存状態
    const [dragInfo, setDragInfo] = useState(null);
    const [resizeInfo, setResizeInfo] = useState(null);
    const [isPanning, setIsPanning] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showAutoLayout, setShowAutoLayout] = useState(false);

    // ツール選択
    const [activeTool, setActiveTool] = useState(null);
    const [arrowStart, setArrowStart] = useState(null);

    // Clean PDF Mode
    const [showCleanPdf, setShowCleanPdf] = useState(false);

    // キャンバス参照
    const canvasRef = useRef(null);
    const scrollContainerRef = useRef(null); // Add ref for scroll container
    const panInfoRef = useRef(null);
    const suppressCanvasClickRef = useRef(false);
    const centerMainAreaInViewport = (behavior = 'auto') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const centerX = (mainAreaOffsetX + (mainAreaWidth / 2)) * zoomScale;
        const centerY = (mainAreaOffsetY + (mainAreaHeight / 2)) * zoomScale;
        const nextLeft = Math.max(0, centerX - (container.clientWidth / 2));
        const nextTop = Math.max(0, centerY - (container.clientHeight / 2));
        container.scrollTo({ left: nextLeft, top: nextTop, behavior });
    };

    // Auto-scroll to center on mount
    useEffect(() => {
        requestAnimationFrame(() => centerMainAreaInViewport());
    }, [scrollContainerRef.current]); // Only run once on mount (or when ref is attached)

    // ============================================================================
    // メートル⇔ピクセル変換
    // ============================================================================
    const metersToPixels = (m) => m * pixelsPerMeter;
    const pixelsToMeters = (px) => px / pixelsPerMeter;

    // ============================================================================
    // ズーム機能
    // ============================================================================
    const clampZoom = (value) => Math.max(0.2, Math.min(2.0, value));
    const handleViewportWheel = (e) => {
        if (e.target.closest('input, textarea, select, button')) return;
        if (dragInfo || resizeInfo || panInfoRef.current) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        e.preventDefault();

        const rect = container.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        setZoomScale(prevZoom => {
            const nextZoom = clampZoom(prevZoom * Math.exp(-e.deltaY * 0.0015));
            if (Math.abs(nextZoom - prevZoom) < 0.0001) return prevZoom;

            const worldX = (container.scrollLeft + pointerX) / prevZoom;
            const worldY = (container.scrollTop + pointerY) / prevZoom;

            requestAnimationFrame(() => {
                const viewport = scrollContainerRef.current;
                if (!viewport) return;
                viewport.scrollLeft = Math.max(0, worldX * nextZoom - pointerX);
                viewport.scrollTop = Math.max(0, worldY * nextZoom - pointerY);
            });

            return nextZoom;
        });
    };
    // ============================================================================
    // 参加確定企業の取得（改善版）
    // ============================================================================
    const getConfirmedMakers = () => {
        // 0. Supplier Code Map for Categories
        // If enterprise list passed, map supplierCode -> category
        const categoryMap = {}; // supplierCode -> categoryInfo
        const colorMap = {}; // categoryName -> color string

        // Generate colors for known categories
        const generateColor = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
            const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
            return "#" + "00000".substring(0, 6 - c.length) + c;
        };

        // Pre-calculate colors for categories in enterprises
        if (enterprises) {
            enterprises.forEach(ent => {
                const entCode = ent.supplierCode || ent.code;
                if (entCode && ent.category) {
                    categoryMap[entCode] = ent.category;
                    // Consistent color for category
                    if (!colorMap[ent.category]) {
                        // Use simple hash for HSL
                        const hash = [].reduce.call(ent.category, (acc, c) => acc + c.charCodeAt(0), 0);
                        const hue = hash % 360;
                        colorMap[ent.category] = `hsl(${hue}, 70%, 90%)`;
                    }
                }
            });
        }

        const getCategoryData = (maker) => {
            // Look for supplier code in maker data
            // Check maker.supplierCode or maker.formData.supplierCode or maker.code
            const code = maker.supplierCode || maker.formData?.supplierCode || maker.code;

            if (code && categoryMap[code]) {
                return { name: categoryMap[code], color: colorMap[categoryMap[code]] };
            }
            // Only valid categories -> otherwise null (White)
            return null;
        };

        // 1. invitedMakers から formData.status === '出展を申し込む' をチェック
        const invitedMakers = exhibition?.invitedMakers || [];
        const fromInvited = invitedMakers.filter(m => {
            const formData = m.formData || {};
            return formData.status === '出展を申し込む';
        }).map(m => {
            const formData = m.formData || {};
            return {
                id: m.id,
                companyName: formData.companyName || m.companyName || '企業名不明',
                deskCount: extractNum(formData.itemsDesk) || 0,
                chairCount: extractNum(formData.itemsChair) || 0,
                hasPower: formData.itemsPower === '必要',
                boothCount: formData.boothCount, // Store raw value for parsing later
                category: getCategoryData(m),
            };
        });

        // 2. confirmedMakers からも取得（直接登録されている場合）
        const confirmedList = exhibition?.confirmedMakers || [];
        const fromConfirmed = confirmedList.map(m => ({
            id: m.id,
            companyName: m.companyName || '企業名不明',
            deskCount: extractNum(m.deskCount) || extractNum(m.itemsDesk) || 0,
            chairCount: extractNum(m.chairCount) || extractNum(m.itemsChair) || 0,
            hasPower: m.hasPower || m.itemsPower === '必要',
            boothCount: m.boothCount || '1コマ',
            category: getCategoryData(m),
        }));

        // 3. makers配列でstatus === 'confirmed'のものも取得
        const makers = exhibition?.makers || [];
        const fromMakers = makers.filter(m => m.status === 'confirmed').map(m => ({
            id: m.id,
            companyName: m.companyName || '企業名不明',
            deskCount: extractNum(m.deskCount) || extractNum(m.itemsDesk) || 0,
            chairCount: extractNum(m.chairCount) || extractNum(m.itemsChair) || 0,
            hasPower: m.hasPower || m.itemsPower === '必要',
            boothCount: m.boothCount || '1コマ',
            category: getCategoryData(m),
        }));

        // IDで重複排除して統合
        const allMakers = [...fromInvited, ...fromConfirmed, ...fromMakers];
        const uniqueIds = new Set();
        return allMakers.filter(m => {
            if (uniqueIds.has(m.id)) return false;
            uniqueIds.add(m.id);
            return true;
        });
    };

    const confirmedMakers = getConfirmedMakers();
    const placedMakerIds = items.filter(i => i.makerId).map(i => i.makerId);
    const unplacedMakers = confirmedMakers.filter(m => !placedMakerIds.includes(m.id));

    // ============================================================================
    // 距離計算（枠線から枠線への距離）
    // ============================================================================
    const calculateDistances = (item) => {
        if (!item) return [];
        const distances = [];

        // 壁との距離（会場エリアの枠線から壁まで）
        // 左壁 (Main Area Left Edge)
        distances.push({
            type: 'wall',
            label: '← 左壁',
            distance: pixelsToMeters(item.x - mainAreaOffsetX),
            x1: item.x,
            y1: item.y + item.h / 2,
            x2: mainAreaOffsetX,
            y2: item.y + item.h / 2,
            direction: 'horizontal'
        });
        // 右壁 (Main Area Right Edge)
        distances.push({
            type: 'wall',
            label: '右壁 →',
            distance: pixelsToMeters((mainAreaOffsetX + mainAreaWidth) - (item.x + item.w)),
            x1: item.x + item.w,
            y1: item.y + item.h / 2,
            x2: mainAreaOffsetX + mainAreaWidth,
            y2: item.y + item.h / 2,
            direction: 'horizontal'
        });
        // 上壁 (Main Area Top Edge)
        distances.push({
            type: 'wall',
            label: '↑ 上壁',
            distance: pixelsToMeters(item.y - mainAreaOffsetY),
            x1: item.x + item.w / 2,
            y1: item.y,
            x2: item.x + item.w / 2,
            y2: mainAreaOffsetY,
            direction: 'vertical'
        });
        // 下壁 (Main Area Bottom Edge)
        distances.push({
            type: 'wall',
            label: '下壁 ↓',
            distance: pixelsToMeters((mainAreaOffsetY + mainAreaHeight) - (item.y + item.h)),
            x1: item.x + item.w / 2,
            y1: item.y + item.h,
            x2: item.x + item.w / 2,
            y2: mainAreaOffsetY + mainAreaHeight,
            direction: 'vertical'
        });

        // 他の要素との距離（枠線から枠線）
        items.forEach(other => {
            if (other.id === item.id) return;
            // Exclude text/arrow from distance display
            if (item.type === 'arrow' || item.type === 'text') return;
            if (other.type === 'arrow' || other.type === 'text') return;

            // 水平方向の枠線間距離 (Require Vertical Overlap)
            const yOverlap = Math.max(item.y, other.y) < Math.min(item.y + item.h, other.y + other.h);

            let hDist = null;
            let hPoints = null;

            if (yOverlap) {
                if (item.x + item.w <= other.x) {
                    // itemが左、otherが右
                    hDist = other.x - (item.x + item.w);
                    hPoints = { x1: item.x + item.w, y1: item.y + item.h / 2, x2: other.x, y2: other.y + other.h / 2 };
                } else if (other.x + other.w <= item.x) {
                    // otherが左、itemが右
                    hDist = item.x - (other.x + other.w);
                    hPoints = { x1: other.x + other.w, y1: other.y + other.h / 2, x2: item.x, y2: item.y + item.h / 2 };
                }
            }

            // 垂直方向の枠線間距離 (Require Horizontal Overlap)
            const xOverlap = Math.max(item.x, other.x) < Math.min(item.x + item.w, other.x + other.w);

            let vDist = null;
            let vPoints = null;

            if (xOverlap) {
                if (item.y + item.h <= other.y) {
                    // itemが上、otherが下
                    vDist = other.y - (item.y + item.h);
                    vPoints = { x1: item.x + item.w / 2, y1: item.y + item.h, x2: other.x + other.w / 2, y2: other.y };
                } else if (other.y + other.h <= item.y) {
                    // otherが上、itemが下
                    vDist = item.y - (other.y + other.h);
                    vPoints = { x1: other.x + other.w / 2, y1: other.y + other.h, x2: item.x + item.w / 2, y2: item.y };
                }
            }

            // 近い要素のみ表示（水平/垂直の最短距離、3m以内）
            if (hDist !== null && pixelsToMeters(hDist) < 3 && (vDist === null || hDist <= (vDist || Infinity))) {
                distances.push({
                    type: 'element',
                    label: `↔ ${pixelsToMeters(hDist).toFixed(1)}m`,
                    distance: pixelsToMeters(hDist),
                    ...hPoints,
                    direction: 'horizontal',
                    targetLabel: other.companyName || other.label || other.type
                });
            }
            if (vDist !== null && pixelsToMeters(vDist) < 3) {
                distances.push({
                    type: 'element',
                    label: `↕ ${pixelsToMeters(vDist).toFixed(1)}m`,
                    distance: pixelsToMeters(vDist),
                    ...vPoints,
                    direction: 'vertical',
                    targetLabel: other.companyName || other.label || other.type
                });
            }
        });

        // Filter Logic
        const isStatic = ['pillar', 'door', 'obstacle'].includes(item.type);

        return distances.filter(d => {
            // If static and it's a Wall distance, ALLOW it regardless of distance?
            if (isStatic && d.type === 'wall') return true;

            // Otherwise apply 3m rule
            return d.distance >= 0 && d.distance <= 3;
        });
    };

    const distances = useMemo(() => {
        if (selectedIds.size !== 1) return [];
        const selectedItem = items.find(i => selectedIds.has(i.id));
        return calculateDistances(selectedItem);
    }, [selectedIds, items, pixelsPerMeter]);

    const resizingItem = useMemo(() => {
        if (!resizeInfo) return null;
        const target = items.find(i => i.id === resizeInfo.id);
        if (!target || target.type === 'arrow') return null;
        return target;
    }, [resizeInfo, items]);

    // ============================================================================
    // 要素追加
    // ============================================================================
    const addElement = (type, makerData = null) => {
        const boothW = metersToPixels(defaultBoothWidth);
        const boothH = metersToPixels(defaultBoothHeight);

        // Calculate center position based on main venue area
        const centerX = mainAreaOffsetX + (mainAreaWidth / 2);
        const centerY = mainAreaOffsetY + (mainAreaHeight / 2);

        let newItem = {
            id: crypto.randomUUID(),
            type,
            x: centerX - (boothW / 2),
            y: centerY - (boothH / 2),
            w: boothW,
            h: boothH,
            rotation: 0,
            label: '',
        };

        switch (type) {
            case 'booth':
                if (makerData) {
                    newItem.makerId = makerData.id;
                    newItem.companyName = makerData.companyName;
                    newItem.deskCount = makerData.deskCount;
                    newItem.chairCount = makerData.chairCount;
                    newItem.hasPower = makerData.hasPower;
                    newItem.label = makerData.companyName;
                    newItem.isEditable = false;
                } else {
                    newItem.isEditable = true;
                    newItem.label = 'ブース';
                }
                break;
            case 'freeBooth':
                newItem.type = 'booth';
                newItem.label = 'ブース';
                newItem.isEditable = true;
                newItem.w = boothW;
                newItem.h = boothH;
                break;
            case 'pillar':
                newItem.w = metersToPixels(0.5);
                newItem.h = metersToPixels(0.5);
                newItem.label = '柱';
                break;
            case 'door':
                newItem.w = metersToPixels(1.5);
                newItem.h = metersToPixels(0.3);
                newItem.label = '入口';
                newItem.doorDirection = 'bottom'; // bottom, top, left, right
                break;
            case 'obstacle':
                newItem.w = metersToPixels(2);
                newItem.h = metersToPixels(2);
                newItem.label = '障害物';
                break;
            case 'text':
                newItem.w = metersToPixels(2);
                newItem.h = metersToPixels(0.5);
                newItem.label = 'テキスト';
                newItem.isEditable = true;
                break;
            case 'venueArea':
                newItem.x = mainAreaOffsetX + metersToPixels(venueWidth); // メインエリアの右側に配置
                newItem.y = mainAreaOffsetY;
                newItem.w = metersToPixels(5);
                newItem.h = metersToPixels(10);
                newItem.label = ''; // ラベルなし
                break;
            default:
                break;
        }

        setItems([...items, newItem]);
        setSelectedIds(new Set([newItem.id]));
        setIsDirty(true);
    };

    const handleViewportMouseDown = (e) => {
        if (e.button !== 0 || activeTool) return;
        const target = e.target;
        if (!target || typeof target.closest !== 'function') return;
        if (target.closest('[data-layout-item=\"true\"]')) return;
        if (target.closest('input, textarea, button, select, label')) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        panInfoRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
            moved: false
        };
        suppressCanvasClickRef.current = false;
        setIsPanning(true);
        e.preventDefault();
    };

    // ============================================================================
    // ドラッグ＆ドロップ処理
    // ============================================================================
    const handleMouseDown = (e, id) => {
        e.stopPropagation();
        if (activeTool) return;

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        } else {
            if (!selectedIds.has(id)) {
                setSelectedIds(new Set([id]));
            }
        }

        const item = items.find(i => i.id === id);
        if (!item) return;

        setDragInfo({
            id, // Dragging primary item
            startX: e.clientX,
            startY: e.clientY,
            currentX: (e.clientX - canvasRef.current.getBoundingClientRect().left) / zoomScale,
            currentY: (e.clientY - canvasRef.current.getBoundingClientRect().top) / zoomScale,
            initialItems: items.filter(i => (e.shiftKey || e.ctrlKey || e.metaKey) ? new Set([...selectedIds, id]).has(i.id) : (selectedIds.has(id) ? selectedIds.has(i.id) : i.id === id)).map(i => ({
                id: i.id,
                x: i.x,
                y: i.y,
                endX: i.endX, // for arrows
                endY: i.endY  // for arrows
            }))
        });
    };

    const handleMouseMove = (e) => {
        if (panInfoRef.current && !dragInfo && !resizeInfo) {
            const container = scrollContainerRef.current;
            if (container) {
                const pan = panInfoRef.current;
                const dx = e.clientX - pan.startX;
                const dy = e.clientY - pan.startY;
                if (!pan.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                    pan.moved = true;
                    suppressCanvasClickRef.current = true;
                }
                container.scrollLeft = pan.scrollLeft - dx;
                container.scrollTop = pan.scrollTop - dy;
                e.preventDefault();
            }
        }

        if (dragInfo) {
            // Delta calculation must account for zoom scale? 
            // Actually simpler to just track absolute mouse position relative to canvas
            const rect = canvasRef.current.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) / zoomScale;
            const mouseY = (e.clientY - rect.top) / zoomScale;

            const dx = mouseX - dragInfo.currentX;
            const dy = mouseY - dragInfo.currentY;

            const newItems = items.map(item => {
                const initial = dragInfo.initialItems.find(Init => Init.id === item.id);
                if (initial) {
                    let newX = Math.round((initial.x + dx) / 10) * 10;
                    let newY = Math.round((initial.y + dy) / 10) * 10;
                    newX = Math.max(0, Math.min(newX, canvasWidth - item.w));
                    newY = Math.max(0, Math.min(newY, canvasHeight - item.h));

                    // Door logic only if single item dragged? Or apply to all doors? 
                    // For simplicity, apply to all doors being dragged
                    let doorDirection = item.doorDirection;
                    if (item.type === 'door') {
                        doorDirection = 'bottom';
                        const distToTop = newY;
                        const distToBottom = canvasHeight - (newY + item.h);
                        const distToLeft = newX;
                        const distToRight = canvasWidth - (newX + item.w);
                        const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
                        if (minDist === distToTop) doorDirection = 'top';
                        else if (minDist === distToBottom) doorDirection = 'bottom';
                        else if (minDist === distToLeft) doorDirection = 'left';
                        else if (minDist === distToRight) doorDirection = 'right';
                    }

                    if (item.type === 'arrow') {
                        const newEndX = Math.round(((initial.endX || 0) + dx) / 10) * 10;
                        const newEndY = Math.round(((initial.endY || 0) + dy) / 10) * 10;
                        return { ...item, x: newX, y: newY, endX: newEndX, endY: newEndY };
                    }

                    return { ...item, x: newX, y: newY, doorDirection };
                }
                return item;
            });
            setItems(newItems);
            if (!dragInfo.isDirty) {
                setIsDirty(true);
                // Optimization: prevent repeatedly setting dirty, though generic batching handles it.
            }
        }

        if (resizeInfo) {
            // Resize delta also needs to be scaled
            const dx = (e.clientX - resizeInfo.startX) / zoomScale;
            const dy = (e.clientY - resizeInfo.startY) / zoomScale;

            if (resizeInfo.handleType === 'arrow-start' || resizeInfo.handleType === 'arrow-end') {
                setItems(items.map(i => {
                    if (i.id !== resizeInfo.id) return i;
                    if (resizeInfo.handleType === 'arrow-start') {
                        const newX = Math.round((resizeInfo.initialX + dx) / 10) * 10;
                        const newY = Math.round((resizeInfo.initialY + dy) / 10) * 10;
                        return { ...i, x: newX, y: newY };
                    } else {
                        const newEndX = Math.round((resizeInfo.initialEndX + dx) / 10) * 10;
                        const newEndY = Math.round((resizeInfo.initialEndY + dy) / 10) * 10;
                        return { ...i, endX: newEndX, endY: newEndY };
                    }
                }));
            } else {
                let newW = Math.max(metersToPixels(0.5), Math.round((resizeInfo.itemW + dx) / 10) * 10);
                let newH = Math.max(metersToPixels(0.5), Math.round((resizeInfo.itemH + dy) / 10) * 10);
                setItems(items.map(i => i.id === resizeInfo.id ? { ...i, w: newW, h: newH } : i));
            }
            setIsDirty(true);
        }
    };

    const handleMouseUp = () => {
        setDragInfo(null);
        setResizeInfo(null);
        panInfoRef.current = null;
        setIsPanning(false);
    };

    const handleResizeStart = (e, id, handleType = 'box') => {
        e.stopPropagation();
        const item = items.find(i => i.id === id);
        if (!item) return;

        setResizeInfo({
            id,
            handleType,
            startX: e.clientX,
            startY: e.clientY,
            itemW: item.w,
            itemH: item.h,
            initialX: item.x, // for arrow
            initialY: item.y, // for arrow
            initialEndX: item.endX, // for arrow
            initialEndY: item.endY // for arrow
        });
    };

    // ============================================================================
    // キャンバスクリック（矢印描画など）
    // ============================================================================
    const handleCanvasClick = (e) => {
        if (suppressCanvasClickRef.current) {
            suppressCanvasClickRef.current = false;
            return;
        }

        if (activeTool === 'arrow' || activeTool === 'double-arrow') {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoomScale;
            const y = (e.clientY - rect.top) / zoomScale;

            if (!arrowStart) {
                setArrowStart({ x, y });
            } else {
                const newArrow = {
                    id: crypto.randomUUID(),
                    type: 'arrow',
                    subtype: activeTool === 'double-arrow' ? 'double' : 'normal',
                    x: arrowStart.x,
                    y: arrowStart.y,
                    endX: x,
                    endY: y,
                    w: 0,
                    h: 0,
                    label: ''
                };
                setItems([...items, newArrow]);
                setArrowStart(null);
                setActiveTool(null);
                setIsDirty(true);
            }
        } else if (activeTool === 'text') {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / zoomScale;
            const y = (e.clientY - rect.top) / zoomScale;

            const newItem = {
                id: crypto.randomUUID(),
                type: 'text',
                x: Math.round(x / 10) * 10,
                y: Math.round(y / 10) * 10,
                w: metersToPixels(2),
                h: metersToPixels(0.5),
                isEditable: true,
                label: '',
                fontSize: 16 // Default font size
            };
            setItems([...items, newItem]);
            setActiveTool(null);
            setSelectedIds(new Set([newItem.id]));
            setIsDirty(true);
        } else {
            setSelectedIds(new Set());
            setIsDirty(true); // Should we dirty on deselect? Maybe not needed but consistent.
        }
    };

    // ============================================================================
    // 要素の削除・更新
    // ============================================================================
    const deleteSelected = () => {
        if (selectedIds.size > 0) {
            setItems(items.filter(i => !selectedIds.has(i.id)));
            setSelectedIds(new Set());
            setIsDirty(true);
        }
    };

    const updateItemProp = (id, key, val) => {
        setItems(items.map(i => i.id === id ? { ...i, [key]: val } : i));
        setIsDirty(true);
    };

    // ============================================================================
    // 自動配置
    // ============================================================================
    const runAutoLayout = () => {
        if (!window.confirm('ブース以外の設置物（柱・ドア・障害物など）を除き、既存の配置はリセットされます。\n自動配置を実行しますか？')) return;

        // カテゴリ順にソート (Group by Category)
        const makers = [...confirmedMakers].sort((a, b) => {
            // Handle null category (put at end)
            const catA = a.category ? a.category.name : 'ZZZZ';
            const catB = b.category ? b.category.name : 'ZZZZ';
            if (catA < catB) return -1;
            if (catA > catB) return 1;

            // If same category, sort by name
            if (a.companyName < b.companyName) return -1;
            if (a.companyName > b.companyName) return 1;

            return 0;
        });

        if (makers.length === 0) {
            alert('参加確定企業がありません');
            return;
        }

        const boothW = metersToPixels(defaultBoothWidth);
        const boothH = metersToPixels(defaultBoothHeight);
        const aisleW = metersToPixels(aisleWidth);
        const backGap = allowBackToBack ? 0 : metersToPixels(0.5);

        // メインエリア内に配置するためのマージン計算
        const margin = metersToPixels(1);
        const marginX = mainAreaOffsetX + margin;
        const marginY = mainAreaOffsetY + margin;
        const usableWidth = mainAreaWidth - 2 * margin;
        const usableHeight = mainAreaHeight - 2 * margin;

        const effectiveBoothWidth = boothW + aisleW;
        const cols = Math.floor((usableWidth + aisleW) / effectiveBoothWidth);
        const rowHeight = allowBackToBack ? (boothH * 2 + backGap + aisleW) : (boothH + aisleW);

        // 既存の「ブース（配置済み企業）」以外のアイテム（柱、ドア、障害物、フリーブースなど）は維持する
        const retainedItems = items.filter(i => {
            // 'booth' タイプかつ makerId があるもの（自動配置対象）は削除対象にするか？
            // ユーザー要望「ブース以外の設置物をリセットしないで」 -> つまり配置済み企業ブースはリセットして再配置する
            return !(i.type === 'booth' && i.makerId);
        });

        // 衝突判定用ヘルパー
        const checkCollision = (rect1, rect2) => {
            return (
                rect1.x < rect2.x + rect2.w &&
                rect1.x + rect1.w > rect2.x &&
                rect1.y < rect2.y + rect2.h &&
                rect1.y + rect1.h > rect2.y
            );
        };

        const newItems = [...retainedItems];
        let currentMakerIdx = 0;
        let rowY = marginY;
        let loopGuard = 0;

        // グリッドスキャン
        // 行ごと・列ごとにスキャンし、空いていれば配置
        const maxY = mainAreaOffsetY + mainAreaHeight - margin;
        while (currentMakerIdx < makers.length && rowY + boothH <= maxY) {
            loopGuard++;
            if (loopGuard > 10000) {
                console.error('Auto layout loop limit reached');
                break;
            }

            for (let col = 0; col < cols && currentMakerIdx < makers.length; col++) {
                const x = marginX + col * effectiveBoothWidth;
                const y = rowY;

                // 衝突チェック
                const candidateRect = { x: x + 5, y: y + 5, w: boothW - 10, h: boothH - 10 }; // マージンを考慮して少し小さく判定
                const hasCollision = retainedItems.some(item => checkCollision(candidateRect, item));

                if (!hasCollision) {
                    const m = makers[currentMakerIdx];

                    // Parse Booth Count (e.g., "2コマ" -> 2)
                    const countStr = String(m.boothCount || '1').replace(/[^\d]/g, '');
                    const count = parseInt(countStr) || 1;
                    const thisBoothW = (boothW * count); // Expand width based on count

                    // Check against main area width properly (with variable width)
                    const maxX = mainAreaOffsetX + mainAreaWidth - margin;
                    if (x + thisBoothW > maxX) {
                        // Force wrap to next row loop
                        col = cols; // Break inner loop
                        continue;
                    }

                    // Collision Check with dynamic width
                    const candidateRect = { x: x + 5, y: y + 5, w: thisBoothW - 10, h: boothH - 10 };
                    const hasCollision = retainedItems.some(item => checkCollision(candidateRect, item));


                    if (!hasCollision) {
                        newItems.push({
                            id: crypto.randomUUID(),
                            type: 'booth',
                            x,
                            y,
                            w: thisBoothW,
                            h: boothH,
                            makerId: m.id,
                            companyName: m.companyName,
                            deskCount: m.deskCount,
                            chairCount: m.chairCount,
                            hasPower: m.hasPower,
                            label: m.companyName,
                            category: m.category, // Store category info
                            rotation: 0
                        });
                        currentMakerIdx++;

                        // Advance extra columns if multi-booth
                        col += (count - 1);
                    } else {
                        // If collision in this slot, loop continues to next col.
                    }
                }
            }

            if (allowBackToBack && currentMakerIdx < makers.length) {
                rowY += boothH + backGap;
                // 背中合わせの行も同様にチェック
                if (rowY + boothH <= canvasHeight - marginY) {
                    for (let col = 0; col < cols && currentMakerIdx < makers.length; col++) {
                        const x = marginX + col * effectiveBoothWidth;
                        const y = rowY;

                        const candidateRect = { x: x + 5, y: y + 5, w: boothW - 10, h: boothH - 10 };
                        const hasCollision = retainedItems.some(item => checkCollision(candidateRect, item));

                        if (!hasCollision) {
                            const m = makers[currentMakerIdx];

                            // Parse Booth Count (Back-to-Back row)
                            const countStr = String(m.boothCount || '1').replace(/[^\d]/g, '');
                            const count = parseInt(countStr) || 1;
                            const thisBoothW = (boothW * count);

                            const maxX = mainAreaOffsetX + mainAreaWidth - margin;
                            if (x + thisBoothW > maxX) {
                                col = cols;
                                continue;
                            }

                            const candidateRect = { x: x + 5, y: y + 5, w: thisBoothW - 10, h: boothH - 10 };
                            const hasCollision = retainedItems.some(item => checkCollision(candidateRect, item));

                            if (!hasCollision) {
                                newItems.push({
                                    id: crypto.randomUUID(),
                                    type: 'booth',
                                    x,
                                    y,
                                    w: thisBoothW,
                                    h: boothH,
                                    makerId: m.id,
                                    companyName: m.companyName,
                                    deskCount: m.deskCount,
                                    chairCount: m.chairCount,
                                    hasPower: m.hasPower,
                                    label: m.companyName,
                                    category: m.category,
                                    rotation: 0
                                });
                                currentMakerIdx++;
                                col += (count - 1);
                            }
                        }
                    }
                }
                rowY += boothH + aisleW;
            } else {
                rowY += rowHeight;
            }
        }

        setItems(newItems);
        setShowAutoLayout(false);
        setSelectedIds(new Set());
        setIsDirty(true);
    };

    // ============================================================================
    // 企業をドロップで配置
    // ============================================================================
    const handleMakerDrop = (e, maker) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = Math.round(((e.clientX - rect.left) / zoomScale) / 10) * 10;
        const y = Math.round(((e.clientY - rect.top) / zoomScale) / 10) * 10;

        const boothW = metersToPixels(defaultBoothWidth);
        const boothH = metersToPixels(defaultBoothHeight);

        const newItem = {
            id: crypto.randomUUID(),
            type: 'booth',
            x: Math.max(0, Math.min(x - boothW / 2, canvasWidth - boothW)),
            y: Math.max(0, Math.min(y - boothH / 2, canvasHeight - boothH)),
            w: boothW,
            h: boothH,
            makerId: maker.id,
            companyName: maker.companyName,
            deskCount: maker.deskCount,
            chairCount: maker.chairCount,
            hasPower: maker.hasPower,
            label: maker.companyName,
            category: maker.category, // Store category
            rotation: 0
        };

        setItems([...items, newItem]);
        setSelectedIds(new Set([newItem.id]));
    };

    // ============================================================================
    // 保存データ形式
    // ============================================================================
    const getSaveData = () => {
        const data = {
            settings: {
                venueWidth,
                venueHeight,
                boothWidth: defaultBoothWidth,
                boothHeight: defaultBoothHeight,
                scale: pixelsPerMeter,
                aisleWidth,
                allowBackToBack
            },
            items
        };
        // Remove undefined values to prevent Firestore errors
        return JSON.parse(JSON.stringify(data));
    };

    // ============================================================================
    // レンダリング: ブース内容
    // ============================================================================
    const renderBoothContent = (item) => {
        if (item.type === 'booth' && item.makerId) {
            const displayLabel = (item.companyName || item.label || '').replace(/(株式会社|有限会社|合同会社|（株）|（有）|（同）)/g, '');
            const powerText = item.hasPower ? '電' : '';
            const infoText = `${item.deskCount || 0}-${item.chairCount || 0}${powerText ? '-' + powerText : ''}`;
            // Use category color if available, else white
            const bgColor = item.category ? item.category.color : 'white';

            return (
                <div
                    className="text-center p-1 overflow-hidden w-full h-full flex flex-col items-center justify-center"
                    style={{ backgroundColor: bgColor }}
                >
                    <div className="booth-label text-[9px] font-bold leading-tight truncate w-full">{displayLabel}</div>
                    <div className="booth-info text-[9px] font-bold text-slate-900">
                        {!showCleanPdf && infoText}
                    </div>
                </div>
            );
        }
        if ((item.type === 'booth' && !item.makerId) || item.type === 'freeBooth') {
            return (
                <div className="w-full h-full flex items-center justify-center p-1">
                    <textarea
                        className="bg-transparent text-[10px] text-center leading-tight whitespace-pre-wrap w-full h-full outline-none font-bold resize-none overflow-hidden"
                        value={item.label || ''}
                        onChange={(e) => updateItemProp(item.id, 'label', e.target.value)}
                        onMouseDown={e => e.stopPropagation()}
                        placeholder="ブース名"
                    />
                </div>
            );
        }
        if (item.type === 'text' && item.isEditable) {
            return (
                <input
                    className="bg-transparent text-center w-full h-full outline-none font-bold"
                    style={{ fontSize: `${item.fontSize || 10}px` }}
                    value={item.label || ''}
                    onChange={(e) => updateItemProp(item.id, 'label', e.target.value)}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="テキスト"
                />
            );
        }
        if (item.type === 'door') {
            return <span className="text-[9px] text-center font-bold text-green-700">🚪 {item.label}</span>;
        }
        if (item.type === 'obstacle') {
            return <span className="text-[9px] text-center text-slate-600">{item.label || '障害物'}</span>;
        }
        if (item.type === 'venueArea') {
            // 追加エリア：グリッド背景付き（メインエリアと同化）
            return (
                <div
                    className="w-full h-full"
                    style={{
                        backgroundSize: `${metersToPixels(1)}px ${metersToPixels(1)}px`,
                        backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)'
                    }}
                />
            );
        }
        return <span className="text-[10px] text-center p-1 pointer-events-none overflow-hidden select-none">{item.label}</span>;
    };

    // ============================================================================
    // レンダリング: 要素スタイル
    // ============================================================================
    const getItemStyle = (item) => {
        switch (item.type) {
            case 'booth':
                return 'bg-white border-2 border-slate-600';
            case 'freeBooth':
                return 'bg-white border-2 border-slate-600';
            case 'pillar':
                return 'bg-slate-500 border border-slate-700';
            case 'venue':
                return 'bg-transparent border-4 border-slate-300 opacity-50';
            case 'venueArea':
                return 'bg-white'; // 境界線なし（メインエリアと完全同化）
            case 'door':
                return 'bg-green-100 border-2 border-green-600';
            case 'obstacle':
                return 'bg-slate-400/80 border border-slate-500';
            case 'text':
                return 'bg-transparent border border-dashed border-slate-300';
            default:
                return 'bg-white border border-slate-300';
        }
    };

    // リセット
    const handleResetLayout = () => {
        if (window.confirm('すべての配置を削除して初期化しますか？')) {
            setItems([]);
            setSelectedIds(new Set());
            setIsDirty(true);
        }
    };

    // ドアの回転角度を計算
    const handleResetBoothsOnly = () => {
        if (window.confirm('ブースのみを削除します。柱・ドア・障害物・テキストなどは残ります。よろしいですか？')) {
            setItems(items.filter(i => i.type !== 'booth' && i.type !== 'freeBooth'));
            setSelectedIds(new Set());
            setIsDirty(true);
        }
    };

    const getDoorRotation = (item) => {
        if (item.type !== 'door') return 0;
        switch (item.doorDirection) {
            case 'left': return 90;
            case 'right': return -90;
            case 'top': return 180;
            default: return 0;
        }
    };

    /* -------------------------------------------------------------------------- */
    /*                            PDF生成 (Clean Re-render)                       */
    /* -------------------------------------------------------------------------- */
    const handleDownloadPDF = async () => {
        if (!canvasRef.current) return;

        // レンダリング待ち
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            // 1. バウンディングボックス = メインエリアの範囲（ブースがない部分も含む）
            // 追加エリアがあればそれも含める
            let minX = mainAreaOffsetX;
            let minY = mainAreaOffsetY;
            let maxX = mainAreaOffsetX + mainAreaWidth;
            let maxY = mainAreaOffsetY + mainAreaHeight;

            const venueItems = items.filter(i => i.type === 'venueArea');
            venueItems.forEach(v => {
                if (v.x < minX) minX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.x + v.w > maxX) maxX = v.x + v.w;
                if (v.y + v.h > maxY) maxY = v.y + v.h;
            });

            // メインエリアの幅と高さ（ワークスペースのオフセットは含めない）
            const cropWidth = maxX - minX;
            const cropHeight = maxY - minY;

            // 2. PDF用の一時コンテナを作成
            // 座標を(0, 0)基準に正規化するため、minX/minYは後でアイテム配置時に使う
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = `${cropWidth}px`;
            container.style.height = `${cropHeight}px`;
            container.style.backgroundColor = '#ffffff';
            container.style.zIndex = '-9999';
            container.style.overflow = 'hidden';
            // グリッド線
            container.style.backgroundImage = `
        linear-gradient(to right, #e2e8f0 1px, transparent 1px),
        linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)
      `;
            container.style.backgroundSize = `${pixelsPerMeter}px ${pixelsPerMeter}px`;

            // 3. アイテムの配置（座標を正規化）
            // アイテムの座標からminX/minYを引くことで、(0, 0)基準に変換

            // A. メインエリアの描画（白背景の矩形として配置）
            const mainArea = document.createElement('div');
            mainArea.style.position = 'absolute';
            mainArea.style.left = `${mainAreaOffsetX - minX}px`;
            mainArea.style.top = `${mainAreaOffsetY - minY}px`;
            mainArea.style.width = `${mainAreaWidth}px`;
            mainArea.style.height = `${mainAreaHeight}px`;
            mainArea.style.backgroundColor = '#ffffff';
            mainArea.style.border = 'none'; // 境界線なし
            container.appendChild(mainArea);

            // B. 全アイテムの配置
            items.forEach(item => {
                const el = document.createElement('div');
                el.style.position = 'absolute';
                el.style.left = `${item.x - minX}px`;
                el.style.top = `${item.y - minY}px`;
                el.style.width = `${item.w}px`;
                el.style.height = `${item.h}px`;
                el.style.boxSizing = 'border-box';

                // アイテムごとのスタイル
                if (item.type === 'venueArea') {
                    el.style.backgroundColor = '#ffffff';
                    el.style.border = 'none'; // 追加エリアも境界線なし
                    // メインエリアと同じグリッド背景を追加（シームレスにするため）
                    el.style.backgroundImage = `
            linear-gradient(to right, #f1f5f9 1px, transparent 1px),
            linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)
          `;
                    el.style.backgroundSize = `${pixelsPerMeter}px ${pixelsPerMeter}px`;
                } else if (item.type === 'booth' || item.type === 'freeBooth') {
                    el.style.border = '2px solid #64748b'; // slate-500
                    el.style.backgroundColor = '#ffffff';
                    el.style.display = 'flex';
                    el.style.flexDirection = 'column';
                    el.style.justifyContent = 'center';
                    el.style.alignItems = 'center';
                    el.style.textAlign = 'center';
                    el.style.padding = '2px';
                    el.style.overflow = 'hidden';

                    // ブース内テキスト
                    const label = document.createElement('div');
                    label.textContent = item.label || 'ブース';
                    label.style.fontSize = '12px'; // 少し大きめに
                    label.style.fontWeight = 'bold';
                    label.style.color = '#000000';
                    label.style.lineHeight = '1.2';
                    label.style.whiteSpace = 'pre-wrap';
                    label.style.wordBreak = 'break-word';
                    label.style.width = '100%';
                    label.style.fontFamily = '"Noto Sans JP", sans-serif'; // フォント指定
                    el.appendChild(label);

                    // 詳細情報 (Clean Modeでない場合)
                    if (!showCleanPdf && item.boothNo) {
                        const info = document.createElement('div');
                        info.textContent = item.boothNo;
                        info.style.fontSize = '9px';
                        info.style.marginTop = '2px';
                        info.style.color = '#333333';
                        el.appendChild(info);
                    }
                } else if (item.type === 'text') {
                    el.textContent = item.label;
                    el.style.fontSize = '14px';
                    el.style.color = '#000000';
                    el.style.whiteSpace = 'pre-wrap';
                } else if (item.type === 'door') {
                    el.style.backgroundColor = '#cbd5e1'; // slate-300
                    el.textContent = '出入口';
                    el.style.fontSize = '10px';
                    el.style.display = 'flex';
                    el.style.justifyContent = 'center';
                    el.style.alignItems = 'center';
                } else if (item.type === 'obstacle') {
                    el.style.backgroundColor = '#f1f5f9'; // slate-100
                    el.style.border = '1px dashed #94a3b8';
                    el.style.display = 'flex';
                    el.style.justifyContent = 'center';
                    el.style.alignItems = 'center';
                    el.style.fontSize = '10px';
                    el.textContent = '柱/障害物';
                }

                // 回転の適用
                if (item.rotation) {
                    el.style.transform = `rotate(${item.rotation}deg)`;
                }

                container.appendChild(el);
            });

            // 4. コンテナを追加してキャプチャ
            document.body.appendChild(container);

            const canvas = await html2canvas(container, {
                scale: 2,
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff',
                // 明示的にサイズを指定してキャプチャ範囲を固定
                width: cropWidth,
                height: cropHeight,
                windowWidth: cropWidth,
                windowHeight: cropHeight,
                onclone: (clonedDoc) => {
                    // カラーサニタイズ
                    const allElements = clonedDoc.querySelectorAll('*');
                    Array.from(allElements).forEach(el => {
                        el.style.color = '#000000';
                        if (el.style.border) {
                            el.style.borderColor = '#64748b';
                        }
                        const computedStyle = window.getComputedStyle(el);
                        const bg = computedStyle.backgroundColor;
                        if (bg && (bg.includes('oklch') || bg.includes('oklab'))) {
                            if (el.textContent === '柱/障害物') {
                                el.style.backgroundColor = '#f1f5f9';
                            } else if (el.textContent === '出入口') {
                                el.style.backgroundColor = '#cbd5e1';
                            } else {
                                el.style.backgroundColor = '#ffffff';
                            }
                        }
                        const borderColor = computedStyle.borderColor;
                        if (borderColor && (borderColor.includes('oklch') || borderColor.includes('oklab'))) {
                            el.style.borderColor = '#64748b';
                        }
                        const color = computedStyle.color;
                        if (color && (color.includes('oklch') || color.includes('oklab'))) {
                            el.style.color = '#000000';
                        }
                    });
                }
            });

            // デバッグ: キャプチャサイズを確認
            console.log('PDF Debug:', {
                cropWidth,
                cropHeight,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                mainAreaWidth,
                mainAreaHeight,
                minX,
                minY
            });

            document.body.removeChild(container);

            // 5. PDF生成
            // 会場の縦横比に応じてPDFの向きを自動選択
            const isLandscape = cropWidth > cropHeight;
            const pdf = new jsPDF({
                orientation: isLandscape ? 'landscape' : 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = isLandscape ? 297 : 210;
            const pageHeight = isLandscape ? 210 : 297;
            const printMargin = 5;
            const printableWidth = pageWidth - printMargin * 2;
            const printableHeight = pageHeight - printMargin * 2;

            const actualWidth = canvas.width;
            const actualHeight = canvas.height;

            // アスペクト比を維持して最大化
            const widthRatio = printableWidth / (actualWidth / 2);
            const heightRatio = printableHeight / (actualHeight / 2);
            const ratio = Math.min(widthRatio, heightRatio);

            const finalWidth = (actualWidth / 2) * ratio;
            const finalHeight = (actualHeight / 2) * ratio;

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            pdf.addImage(canvas, 'PNG', x, y, finalWidth, finalHeight);
            pdf.save('layout.pdf');

        } catch (err) {
            console.error('PDF Generation Error:', err);
            alert('PDF生成に失敗しました: ' + err.message);
        }
    };
    // ============================================================================
    // レンダリング
    // ============================================================================
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col animate-scale-up overflow-hidden">
                {/* Header */}
                <div className="p-3 border-b flex justify-between items-center bg-slate-50 shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-lg flex items-center gap-2"><LayoutDashboard size={20} /> レイアウト作成ツール</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="bg-slate-100 px-2 py-1 rounded">{venueWidth}m × {venueHeight}m</span>
                            <span className="bg-slate-100 px-2 py-1 rounded">ブース: {defaultBoothWidth}m × {defaultBoothHeight}m</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* ズームコントロール */}
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1">
                            <span className="text-xs font-bold w-12 text-center">{Math.round(zoomScale * 100)}%</span>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">ホイールで拡大縮小</span>
                        </div>
                        <button
                            onClick={() => centerMainAreaInViewport('smooth')}
                            className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 text-sm"
                        >
                            中央に戻る
                        </button>
                        <button onClick={() => setShowSettings(true)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 flex items-center gap-2 text-sm">
                            <Settings size={16} /> 設定
                        </button>
                        <button onClick={() => { onSave(getSaveData()); setIsDirty(false); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                            <Save size={16} /> 保存
                        </button>
                        <button onClick={() => setShowCleanPdf(!showCleanPdf)} className={`px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-sm border ${showCleanPdf ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-white text-slate-600 border-slate-200'}`}>
                            {showCleanPdf ? <Eye size={16} /> : <Eye size={16} />} {showCleanPdf ? '詳細非表示中' : '詳細表示中'}
                        </button>
                        <button onClick={handleDownloadPDF} className="bg-slate-800 text-white px-3 py-2 rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2 text-sm">
                            <Download size={16} /> PDF
                        </button>
                        <button onClick={() => {
                            if (isDirty && !window.confirm('保存されていない変更があります。閉じてもよろしいですか？')) return;
                            onClose();
                        }} className="bg-white text-slate-500 border px-3 py-2 rounded-lg font-bold hover:bg-slate-50"><X size={16} /></button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-2 border-b bg-white flex justify-between items-center shrink-0 flex-wrap gap-2">
                    <div className="flex gap-1 flex-wrap">
                        <button onClick={() => addElement('booth')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold flex gap-1 items-center"><Plus size={12} /> ブース</button>
                        <div className="w-px bg-slate-200 mx-1"></div>
                        <button onClick={() => addElement('pillar')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold flex gap-1 items-center"><Box size={12} /> 柱</button>
                        <button onClick={() => addElement('venueArea')} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-bold flex gap-1 items-center text-slate-700"><Square size={12} /> 会場追加</button>
                        <button onClick={() => addElement('door')} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded text-xs font-bold flex gap-1 items-center"><Plus size={12} /> ドア</button>
                        <button onClick={() => addElement('obstacle')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold flex gap-1 items-center"><XCircle size={12} /> 障害物</button>
                        <button
                            onClick={() => setActiveTool(activeTool === 'arrow' ? null : 'arrow')}
                            className={`px-3 py-1.5 rounded text-xs font-bold flex gap-1 items-center ${activeTool === 'arrow' ? 'bg-amber-500 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-600'}`}
                        >
                            <ArrowRight size={12} /> 矢印
                        </button>
                        <button
                            onClick={() => setActiveTool(activeTool === 'double-arrow' ? null : 'double-arrow')}
                            className={`px-3 py-1.5 rounded text-xs font-bold flex gap-1 items-center ${activeTool === 'double-arrow' ? 'bg-amber-500 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-600'}`}
                        >
                            <ArrowRight size={12} className="rotate-180" /> 双方向
                        </button>
                        <button
                            onClick={() => setActiveTool(activeTool === 'text' ? null : 'text')}
                            className={`px-3 py-1.5 rounded text-xs font-bold flex gap-1 items-center ${activeTool === 'text' ? 'bg-blue-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                        >
                            <Edit3 size={12} /> 文字
                        </button>
                        <div className="w-px bg-slate-200 mx-1"></div>

                        {selectedIds.size === 1 && items.find(i => selectedIds.has(i.id))?.type === 'text' && (
                            <div className="flex items-center gap-1 bg-slate-100 rounded px-1">
                                <span className="text-[10px] font-bold text-slate-500">サイズ</span>
                                <input
                                    type="number"
                                    min="8" max="100"
                                    value={items.find(i => selectedIds.has(i.id))?.fontSize || 10}
                                    onChange={(e) => updateItemProp(items.find(i => selectedIds.has(i.id)).id, 'fontSize', Number(e.target.value))}
                                    className="w-12 text-xs border rounded px-1 py-0.5"
                                />
                            </div>
                        )}

                        <button onClick={deleteSelected} disabled={selectedIds.size === 0} className="px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded text-xs font-bold disabled:opacity-50 flex gap-1 items-center"><Trash2 size={12} /> 削除</button>
                        <button onClick={handleResetBoothsOnly} className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-bold flex gap-1 items-center border border-amber-200"><Trash2 size={12} /> ブースのみ全クリア</button>
                        <button onClick={handleResetLayout} className="px-3 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded text-xs font-bold flex gap-1 items-center border border-red-200"><Trash2 size={12} /> 全クリア</button>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* 選択中要素のサイズ表示 */}
                        {
                            (() => {
                                if (selectedIds.size !== 1) return null;
                                const selectedItem = items.find(i => i.id === Array.from(selectedIds)[0]);
                                if (!selectedItem || selectedItem.type === 'arrow') return null;
                                return (
                                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 font-bold">
                                        📐 {pixelsToMeters(selectedItem.w).toFixed(1)}m × {pixelsToMeters(selectedItem.h).toFixed(1)}m
                                    </span>
                                );
                            })()
                        }
                        <button onClick={() => setShowAutoLayout(true)} className="px-3 py-1.5 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded text-xs font-bold flex gap-1 items-center border border-purple-200">
                            <LayoutGrid size={12} /> 自動配置
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Canvas Area */}
                    <div
                        ref={scrollContainerRef}
                        className={`flex-1 overflow-auto bg-slate-200 p-4 ${isPanning ? 'cursor-grabbing' : activeTool ? '' : 'cursor-grab'}`}
                        onWheel={handleViewportWheel}
                        onMouseDown={handleViewportMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <div
                            ref={canvasRef}
                            className={`bg-slate-300 shadow-xl relative select-none mx-auto ${isPanning ? 'cursor-grabbing' : (activeTool === 'arrow' || activeTool === 'double-arrow' || activeTool === 'text') ? 'cursor-crosshair' : ''}`}
                            style={{
                                width: canvasWidth,
                                height: canvasHeight,
                                transform: `scale(${zoomScale})`,
                                transformOrigin: '0 0',
                                backgroundSize: `${metersToPixels(1)}px ${metersToPixels(1)}px`,
                                backgroundImage: 'linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)'
                            }}
                            onClick={handleCanvasClick}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                try {
                                    const maker = JSON.parse(e.dataTransfer.getData('maker'));
                                    if (maker) handleMakerDrop(e, maker);
                                } catch (err) { }
                            }}
                        >
                            {/* メインエリア表示（設定した会場サイズ） */}
                            <div
                                className="absolute bg-white pointer-events-none" // 枠線(border)削除
                                style={{
                                    left: mainAreaOffsetX,
                                    top: mainAreaOffsetY,
                                    width: mainAreaWidth,
                                    height: mainAreaHeight,
                                    backgroundSize: `${metersToPixels(1)}px ${metersToPixels(1)}px`,
                                    backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)'
                                }}
                            >
                                <span className="absolute top-1 left-1 text-[10px] font-bold text-slate-400 bg-white/80 px-1 rounded">
                                    メインエリア ({venueWidth}m × {venueHeight}m)
                                </span>
                            </div>
                            {items.map(item => {
                                if (item.type === 'arrow') {
                                    // Draw Arrow
                                    const isSelected = selectedIds.has(item.id);
                                    const dx = item.endX - item.x;
                                    const dy = item.endY - item.y;
                                    const len = Math.sqrt(dx * dx + dy * dy);
                                    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                                    return (
                                        <div key={item.id} className="absolute top-0 left-0 w-0 h-0">
                                            <div
                                                className={`absolute border-b-2 ${isSelected ? 'border-amber-600' : 'border-amber-500'}`}
                                                style={{
                                                    left: item.x,
                                                    top: item.y,
                                                    width: len,
                                                    transformOrigin: '0 0',
                                                    transform: `rotate(${angle}deg)`,
                                                    pointerEvents: 'none' // Click handling on handles or invisible box?
                                                    // Actually we need click on the LINE. Hard with div. 
                                                    // Let's use SVG or a thick div.
                                                }}
                                            />
                                            {/* Arrow Head (End) */}
                                            <div
                                                className={`absolute w-0 h-0 border-solid border-t-transparent border-b-transparent ${isSelected ? 'border-l-amber-600' : 'border-l-amber-500'}`}
                                                style={{
                                                    left: item.endX,
                                                    top: item.endY,
                                                    borderWidth: '5px 0 5px 10px',
                                                    transform: `translate(-100%, -50%) rotate(${angle}deg)`,
                                                    transformOrigin: '100% 50%',
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                            {/* Arrow Head (Start) - For Double Arrow */}
                                            {item.subtype === 'double' && (
                                                <div
                                                    className={`absolute w-0 h-0 border-solid border-t-transparent border-b-transparent ${isSelected ? 'border-r-amber-600' : 'border-r-amber-500'}`}
                                                    style={{
                                                        left: item.x,
                                                        top: item.y,
                                                        borderWidth: '5px 10px 5px 0',
                                                        transform: `translate(0, -50%) rotate(${angle}deg)`,
                                                        transformOrigin: '0 50%',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                            )}
                                            {/* Clickable Area (Thick Line) */}
                                            <div
                                                data-layout-item="true"
                                                className="absolute cursor-move"
                                                onMouseDown={(e) => handleMouseDown(e, item.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    left: item.x,
                                                    top: item.y,
                                                    width: len,
                                                    height: '10px',
                                                    transformOrigin: '0 5px',
                                                    transform: `translate(0, -5px) rotate(${angle}deg)`,
                                                    zIndex: 10
                                                }}
                                            />
                                            {/* Handles */}
                                            {isSelected && (
                                                <>
                                                    <div
                                                        className="absolute w-3 h-3 bg-white border-2 border-amber-600 rounded-full cursor-move z-20"
                                                        style={{ left: item.x, top: item.y, transform: 'translate(-50%, -50%)' }}
                                                        onMouseDown={(e) => handleResizeStart(e, item.id, 'arrow-start')}
                                                    />
                                                    <div
                                                        className="absolute w-3 h-3 bg-white border-2 border-amber-600 rounded-full cursor-move z-20"
                                                        style={{ left: item.endX, top: item.endY, transform: 'translate(-50%, -50%)' }}
                                                        onMouseDown={(e) => handleResizeStart(e, item.id, 'arrow-end')}
                                                    />
                                                </>
                                            )}
                                        </div>
                                    );
                                }

                                return ( // Existing item render
                                    <div
                                        key={item.id}
                                        data-layout-item="true"
                                        className={`absolute group touch-none select-none ${activeTool ? '' : 'cursor-move'} ${getItemStyle(item)} ${selectedIds.has(item.id) ? 'ring-2 ring-blue-500 z-10' : ''}`}
                                        style={{
                                            left: item.x,
                                            top: item.y,
                                            width: item.w,
                                            height: item.h,
                                            transform: `rotate(${item.rotation || 0}deg)`, // Simple rotation for now
                                        }}
                                        onMouseDown={(e) => handleMouseDown(e, item.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {renderBoothContent(item)}

                                        {/* Resize Handle (Bottom-Right) */}
                                        {selectedIds.has(item.id) && item.isEditable !== false && (
                                            <div
                                                className="absolute bottom-0 right-0 w-4 h-4 bg-white border-2 border-blue-500 cursor-nwse-resize z-20"
                                                onMouseDown={(e) => handleResizeStart(e, item.id)}
                                            />
                                        )}
                                        {/* Door Rotation Handle? (Optional) */}
                                    </div>
                                )
                            })}


                            {/* Distances (Outside Map loop) */}
                            {/* 距離表示（SVGオーバーレイ） - 1つだけ選択時のみ */}
                            {selectedIds.size === 1 && (
                                <svg className="absolute inset-0 pointer-events-none z-30" style={{ width: canvasWidth, height: canvasHeight }}>
                                    {distances.map((d, idx) => (
                                        <g key={idx}>
                                            <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2" />
                                            <rect
                                                x={(d.x1 + d.x2) / 2 - 20}
                                                y={(d.y1 + d.y2) / 2 - 8}
                                                width="40"
                                                height="14"
                                                fill="white"
                                                rx="2"
                                                opacity="0.9"
                                            />
                                            <text
                                                x={(d.x1 + d.x2) / 2}
                                                y={(d.y1 + d.y2) / 2 + 3}
                                                fill="#ef4444"
                                                fontSize="10"
                                                fontWeight="bold"
                                                textAnchor="middle"
                                            >
                                                {d.distance.toFixed(1)}m
                                            </text>
                                        </g>
                                    ))}
                                </svg>
                            )}

                            {/* リサイズ中のサイズ表示 */}
                            {resizingItem && (<>
                                <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold z-50 shadow-lg">
                                    📐 {pixelsToMeters(resizingItem.w || 0).toFixed(1)}m × {pixelsToMeters(resizingItem.h || 0).toFixed(1)}m
                                </div>
                                <div className="absolute pointer-events-none z-50" style={{ left: resizingItem.x, top: resizingItem.y, width: resizingItem.w, height: resizingItem.h }}>
                                    <div className="absolute left-0 right-0 -top-3 border-t border-dashed border-blue-400" />
                                    <div className="absolute left-0 right-0 -bottom-3 border-t border-dashed border-blue-400" />
                                    <div className="absolute top-0 bottom-0 -left-3 border-l border-dashed border-blue-400" />
                                    <div className="absolute top-0 bottom-0 -right-3 border-l border-dashed border-blue-400" />
                                </div>

                                <div className="absolute pointer-events-none z-50" style={{ left: resizingItem.x + resizingItem.w / 2, top: Math.max(0, resizingItem.y - 22), transform: 'translateX(-50%)' }}>
                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">{pixelsToMeters(resizingItem.w || 0).toFixed(1)}m</span>
                                </div>
                                <div className="absolute pointer-events-none z-50" style={{ left: resizingItem.x + resizingItem.w / 2, top: resizingItem.y + resizingItem.h + 8, transform: 'translateX(-50%)' }}>
                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">{pixelsToMeters(resizingItem.w || 0).toFixed(1)}m</span>
                                </div>
                                <div className="absolute pointer-events-none z-50" style={{ left: Math.max(0, resizingItem.x - 18), top: resizingItem.y + resizingItem.h / 2, transform: 'translate(-100%, -50%) rotate(-90deg)' }}>
                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">{pixelsToMeters(resizingItem.h || 0).toFixed(1)}m</span>
                                </div>
                                <div className="absolute pointer-events-none z-50" style={{ left: resizingItem.x + resizingItem.w + 18, top: resizingItem.y + resizingItem.h / 2, transform: 'translate(0, -50%) rotate(-90deg)' }}>
                                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">{pixelsToMeters(resizingItem.h || 0).toFixed(1)}m</span>
                                </div>
                                </>
                            )}

                            {/* 矢印描画中のプレビュー */}
                            {(activeTool === 'arrow' || activeTool === 'double-arrow') && arrowStart && (
                                <svg className="absolute inset-0 pointer-events-none z-30" style={{ width: canvasWidth, height: canvasHeight }}>
                                    <circle cx={arrowStart.x} cy={arrowStart.y} r="5" fill="#f59e0b" />
                                    <text x={arrowStart.x + 10} y={arrowStart.y - 5} fontSize="10" fill="#f59e0b">クリックで終点</text>
                                </svg>
                            )}



                            <div className="absolute bottom-1 right-2 text-[10px] text-slate-300 pointer-events-none">{venueWidth}m × {venueHeight}m ({canvasWidth}×{canvasHeight}px)</div>
                        </div>
                    </div>

                    {/* Right Sidebar - 参加確定企業リスト */}
                    <div className="w-64 border-l bg-slate-50 flex flex-col shrink-0">
                        <div className="p-3 border-b bg-white">
                            <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2"><Users size={16} /> 参加確定企業</h4>
                            <p className="text-[10px] text-slate-400 mt-1">ドラッグして配置</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {unplacedMakers.length === 0 && confirmedMakers.length === 0 && (
                                <div className="text-xs text-slate-400 text-center py-4">
                                    <p>参加確定企業がありません</p>
                                    <p className="text-[10px] mt-2 text-slate-300">招待メーカー管理で<br />「出展を申し込む」と回答した<br />企業が表示されます</p>
                                </div>
                            )}
                            {unplacedMakers.length === 0 && confirmedMakers.length > 0 && (
                                <p className="text-xs text-green-600 text-center py-4 bg-green-50 rounded">✓ 全社配置完了</p>
                            )}
                            {unplacedMakers.map(maker => (
                                <div key={maker.id} draggable onDragEnd={(e) => handleMakerDrop(e, maker)} className="p-2 bg-white border border-slate-200 rounded-lg cursor-grab hover:shadow-md hover:border-blue-300 transition-all">
                                    <div className="text-xs font-bold text-slate-700 truncate">{maker.companyName}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">机:{maker.deskCount} 椅子:{maker.chairCount} {maker.hasPower ? '電源:要' : ''}</div>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 border-t bg-white text-[10px] text-slate-500">
                            <div className="flex justify-between"><span>確定企業数:</span><span className="font-bold">{confirmedMakers.length}社</span></div>
                            <div className="flex justify-between"><span>配置済み:</span><span className="font-bold text-green-600">{placedMakerIds.length}社</span></div>
                            <div className="flex justify-between"><span>未配置:</span><span className="font-bold text-amber-600">{unplacedMakers.length}社</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 設定モーダル */}
            {
                showSettings && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-up">
                            <div className="p-4 border-b flex justify-between items-center"><h4 className="font-bold">レイアウト設定</h4><button onClick={() => setShowSettings(false)}><X /></button></div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">会場サイズ (メートル)</label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="5"
                                                max="100"
                                                value={venueWidth}
                                                onChange={e => setVenueWidth(e.target.value ? Number(e.target.value) : 0)}
                                                className="w-full border p-2 rounded text-right"
                                                placeholder="幅"
                                            />
                                        </div>
                                        <span className="font-bold">×</span>
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="5"
                                                max="100"
                                                value={venueHeight}
                                                onChange={e => setVenueHeight(e.target.value ? Number(e.target.value) : 0)}
                                                className="w-full border p-2 rounded text-right"
                                                placeholder="高さ"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">m</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">ブースサイズ (メートル)</label>
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1"
                                                max="10"
                                                value={defaultBoothWidth}
                                                onChange={e => setDefaultBoothWidth(e.target.value ? Number(e.target.value) : 0)}
                                                className="w-full border p-2 rounded text-right"
                                                placeholder="幅"
                                            />
                                        </div>
                                        <span className="font-bold">×</span>
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="1"
                                                max="10"
                                                value={defaultBoothHeight}
                                                onChange={e => setDefaultBoothHeight(e.target.value ? Number(e.target.value) : 0)}
                                                className="w-full border p-2 rounded text-right"
                                                placeholder="高さ"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">m</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">描画スケール（px/m）</label>
                                    <div className="flex gap-2 items-center">
                                        <input type="range" min="20" max="80" value={pixelsPerMeter} onChange={e => setPixelsPerMeter(Number(e.target.value))} className="flex-1" />
                                    </div>
                                    <div className="text-xs text-slate-400 text-center mt-1">{Math.round(pixelsPerMeter / 40 * 100)}% ({pixelsPerMeter}px/m) / ズームはキャンバス上でホイール操作</div>
                                </div>
                            </div>
                            <div className="p-4 border-t flex justify-end"><button onClick={() => setShowSettings(false)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">閉じる</button></div>
                        </div>
                    </div>
                )
            }

            {/* 自動配置モーダル */}
            {
                showAutoLayout && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-slide-up">
                            <div className="p-4 border-b flex justify-between items-center"><h4 className="font-bold flex items-center gap-2"><LayoutGrid size={18} /> 自動配置設定</h4><button onClick={() => setShowAutoLayout(false)}><X /></button></div>
                            <div className="p-6 space-y-4">
                                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700"><p className="font-bold mb-1">参加確定企業: {confirmedMakers.length}社</p><p>全ての参加確定企業を自動的に配置します</p></div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">通路幅 (メートル)</label>
                                    <input type="number" step="0.5" min="1" max="5" value={aisleWidth} onChange={e => setAisleWidth(e.target.value ? Number(e.target.value) : 0)} className="w-full border p-2 rounded text-right" />
                                </div>
                                <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={allowBackToBack} onChange={e => setAllowBackToBack(e.target.checked)} className="w-4 h-4" /><span className="text-sm font-bold text-slate-700">ブースの背中合わせを許可</span></label><p className="text-xs text-slate-400 mt-1 ml-6">通路スペースを節約できます</p></div>
                            </div>
                            <div className="p-4 border-t flex justify-end gap-2"><button onClick={() => setShowAutoLayout(false)} className="px-4 py-2 text-slate-500 font-bold">キャンセル</button><button onClick={runAutoLayout} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700">自動配置を実行</button></div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
