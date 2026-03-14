$(document).ready(function () {
    console.log("初始化...");
    
    // ==================== 应用程序状态 ====================
    var appState = {
        map: null,
        provinceLayers: null,
        currentHighlightedLayer: null,
        lastClickedProvinceName: null,
        provinceInfoDB: {},
        geoJsonFeatures: [],
        initialized: false,
        dataLoaded: false,
        randomMarkers: [],
        randomJitterTimer: null,
        poiMarkers: [],
        characterMarker: null,
        characterPopup: null,
        tasks: [],
        markerScale: {
            enabled: false,
            baseZoom: null,
            minScale: 0.6,
            maxScale: 2.2
        },
        _markerScaleHandler: null
    };

    var feature_position ={
        lazi: "https://ditu.amap.com/place/B0FFFVT6GP",
        zenggao: "https://ditu.amap.com/place/B0FFG0SOIG",
        xiqu: "https://ditu.amap.com/place/B0JRZ5C12Z",
        
    };
    
    // 任务配置：与特色点位 name 一一对应
    var TASK_CONFIG = [
        { id: 'xiqu', title: '参观陕西戏曲非遗博物馆' },
        { id: 'lazi', title: '品尝兴平辣子作坊' },
        { id: 'zenggao', title: '打卡西安粘糕甑糕' },
        { id: 'baihuo', title: '体验汉阴白火石汆汤' },
        { id: 'xun', title: '了解长安埙社与埙文化' }
    ];
    
    // ==================== 工具函数 ====================
    function updateStatus(indicatorId, status, message) {
        var $indicator = $('#' + indicatorId);
        $indicator.removeClass('loaded error');
        
        if (status === 'loading') {
            $indicator.html('<i class="fas fa-spinner fa-spin"></i> ' + message);
        } else if (status === 'loaded') {
            $indicator.html('<i class="fas fa-circle"></i> ' + message).addClass('loaded');
        } else if (status === 'error') {
            $indicator.html('<i class="fas fa-circle"></i> ' + message).addClass('error');
        }
    }
    
    function hideLoading() {
        $('#loadingMessage').fadeOut(300);
    }
    
    function showError(message) {
        console.error('❌', message);
        $('#loadingMessage').html(
            '<div style="color:#e74c3c;padding:20px;text-align:center;">' +
            '<i class="fas fa-exclamation-triangle fa-2x"></i><br>' +
            '<h3>加载错误</h3>' +
            '<p>' + message + '</p>' +
            '<button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;">重新加载</button>' +
            '</div>'
        );
    }

    // ==================== 任务栏 ====================

    function initTasks() {
        appState.tasks = TASK_CONFIG.map(function (t) {
            return {
                id: t.id,
                title: t.title,
                completed: false
            };
        });
        renderTasks();
    }

    function renderTasks() {
        if (!appState.tasks || !appState.tasks.length) return;
        var total = appState.tasks.length;
        var done = appState.tasks.filter(function (t) { return t.completed; }).length;

        var html = appState.tasks.map(function (t) {
            var cls = 'task-item' + (t.completed ? ' completed' : '');
            var icon = t.completed ? '✓' : '';
            return '' +
                '<li class="' + cls + '" data-task-id="' + t.id + '">' +
                    '<span class="task-status">' + icon + '</span>' +
                    '<span class="task-title">' + t.title + '</span>' +
                '</li>';
        }).join('');

        $('#taskList').html(html);
        $('#taskProgress').text('已完成 ' + done + ' / ' + total + ' 个任务');
    }

    function completeTaskForFeature(props) {
        if (!props || !props.name || !appState.tasks) return;
        var id = props.name;
        var changed = false;
        appState.tasks.forEach(function (t) {
            if (t.id === id && !t.completed) {
                t.completed = true;
                changed = true;
            }
        });
        if (changed) {
            renderTasks();
        }
    }
    // ==================== 页面中央弹窗 ====================

    function showPointModal(options) {
        var imageUrl = options.imageUrl || '';
        var text = options.text || '陕西非遗戏曲博物馆讲解9折优惠';
        $('#pointModalImage').attr('src', imageUrl).attr('alt', '');
        $('#pointModalText').text(text);
        $('#pointModal').addClass('point-modal--show').attr('aria-hidden', 'false');
    }

    function closePointModal() {
        $('#pointModal').removeClass('point-modal--show').attr('aria-hidden', 'true');
    }

    $(document).on('click', '.point-modal-close', closePointModal);
    $(document).on('click', '.point-modal-btn-claim', closePointModal);
    $(document).on('click', '#pointModal', function (e) {
        if (e.target === this) closePointModal();
    });

    // ==================== 角色点位对话 ====================

    var characterDialogScript = {
        npc: [
            '迭发埙篪奏，相将金玉音。你想了解埙的历史吗',
            '埙是中国最古老的闭口吹奏乐器之一，距今约7000年，从狩猎工具演变为八音之“土”，贯穿上古至当代，是中国音乐史的“活化石”。'
        ],
        user: ['好啊，请你介绍一下', '原来如此。']
    };

    var characterDialogState = {
        open: false,
        phase: 0, // 0: 等待用户回复1, 0.5: NPC 第二句动画中, 1: 等待用户回复2, 2: 完成(离开)
        messages: [] // { side: 'left'|'right', text: string }
    };

    function escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function renderCharacterDialog() {
        if (!appState.map || !appState.characterMarker) return;

        if (!appState.characterPopup) {
            appState.characterPopup = L.popup({
                closeButton: false,
                autoPan: true,
                className: 'character-dialog-popup',
                offset: [0, -120]
            });
        }

        var p = characterDialogState.phase;
        var btnText;
        if (p < 0.5) {
            btnText = characterDialogScript.user[0];
        } else if (p < 1.5) {
            btnText = characterDialogScript.user[1];
        } else {
            btnText = '离开';
        }

        var itemsHtml = characterDialogState.messages.map(function (m, index) {
            var isLast = index === characterDialogState.messages.length - 1;
            var clsNew = isLast ? ' wechat-msg--new' : '';
            if (m.side === 'left') {
                return (
                    '<div class="wechat-msg wechat-msg--left' + clsNew + '">' +
                        '<div class="wechat-avatar" aria-hidden="true"></div>' +
                        '<div class="wechat-bubble wechat-bubble--left"><div class="wechat-text">' +
                            escapeHtml(m.text) +
                        '</div></div>' +
                    '</div>'
                );
            }

            return (
                '<div class="wechat-msg wechat-msg--right' + clsNew + '">' +
                    '<div class="wechat-bubble wechat-bubble--right"><div class="wechat-text">' +
                        escapeHtml(m.text) +
                    '</div></div>' +
                '</div>'
            );
        }).join('');

        var html =
            '<div class="character-dialog wechat-chat" data-phase="' + characterDialogState.phase + '">' +
                '<div class="wechat-log" id="wechatLog">' + itemsHtml + '</div>' +
                '<div class="wechat-actions">' +
                    '<button type="button" class="character-dialog-btn wechat-action-btn">' + escapeHtml(btnText) + '</button>' +
                '</div>' +
            '</div>';

        appState.characterPopup
            .setLatLng(appState.characterMarker.getLatLng())
            .setContent(html)
            .openOn(appState.map);

        // 渲染后滚动到底部
        setTimeout(function () {
            var el = document.getElementById('wechatLog');
            if (el) el.scrollTop = el.scrollHeight;
        }, 0);
    }

    function openCharacterDialog() {
        if (!appState.map || !appState.characterMarker) return;
        characterDialogState.open = true;
        characterDialogState.phase = 0;
        characterDialogState.messages = [
            { side: 'left', text: characterDialogScript.npc[0] }
        ];
        renderCharacterDialog();
    }

    $(document).on('click', '.character-dialog-btn', function () {
        if (!characterDialogState.open) return;

        var p = characterDialogState.phase;

        if (p < 0.5) {
            characterDialogState.messages.push({ side: 'right', text: characterDialogScript.user[0] });
            characterDialogState.phase = 0.5;
            renderCharacterDialog();
            setTimeout(function () {
                if (!characterDialogState.open || characterDialogState.phase !== 0.5) return;
                characterDialogState.messages.push({ side: 'left', text: characterDialogScript.npc[1] });
                characterDialogState.phase = 1;
                renderCharacterDialog();
            }, 900);
            return;
        }

        if (p < 1.5) {
            characterDialogState.messages.push({ side: 'right', text: characterDialogScript.user[1] });
            characterDialogState.phase = 2;
            renderCharacterDialog();
            return;
        }

        // phase >= 2
        if (appState.map && appState.characterPopup) {
            appState.map.closePopup(appState.characterPopup);
        }
        characterDialogState.open = false;
    });

    // ==================== 点位随缩放 ====================

    function registerScalableMarker(marker) {
        if (!marker || !marker.options || !marker.options.icon || !marker.options.icon.options) return;
        if (marker.__baseIconOptions) return;

        var o = marker.options.icon.options;
        marker.__baseIconOptions = {
            iconUrl: o.iconUrl,
            iconRetinaUrl: o.iconRetinaUrl,
            shadowUrl: o.shadowUrl,
            shadowRetinaUrl: o.shadowRetinaUrl,
            shadowSize: o.shadowSize ? [o.shadowSize[0], o.shadowSize[1]] : null,
            shadowAnchor: o.shadowAnchor ? [o.shadowAnchor[0], o.shadowAnchor[1]] : null,
            iconSize: o.iconSize ? [o.iconSize[0], o.iconSize[1]] : null,
            iconAnchor: o.iconAnchor ? [o.iconAnchor[0], o.iconAnchor[1]] : null,
            popupAnchor: o.popupAnchor ? [o.popupAnchor[0], o.popupAnchor[1]] : null,
            className: o.className
        };
    }

    function applyScaleToMarker(marker, scale) {
        if (!marker) return;
        registerScalableMarker(marker);
        var b = marker.__baseIconOptions;
        if (!b || !b.iconUrl || !b.iconSize) return;

        var iconSize = [
            Math.max(1, Math.round(b.iconSize[0] * scale)),
            Math.max(1, Math.round(b.iconSize[1] * scale))
        ];

        var iconAnchor = b.iconAnchor
            ? [Math.round(b.iconAnchor[0] * scale), Math.round(b.iconAnchor[1] * scale)]
            : [Math.round(iconSize[0] / 2), Math.round(iconSize[1] / 2)];

        var popupAnchor = b.popupAnchor
            ? [Math.round(b.popupAnchor[0] * scale), Math.round(b.popupAnchor[1] * scale)]
            : [0, -Math.round(iconSize[1] / 2)];

        var nextIcon = L.icon({
            iconUrl: b.iconUrl,
            iconRetinaUrl: b.iconRetinaUrl,
            shadowUrl: b.shadowUrl,
            shadowRetinaUrl: b.shadowRetinaUrl,
            shadowSize: b.shadowSize,
            shadowAnchor: b.shadowAnchor,
            className: b.className,
            iconSize: iconSize,
            iconAnchor: iconAnchor,
            popupAnchor: popupAnchor
        });

        marker.setIcon(nextIcon);
    }

    function applyAllMarkerScale() {
        if (!appState.map || !appState.markerScale.enabled) return;

        var zoom = appState.map.getZoom();
        var baseZoom = 20;
        var delta = (zoom - baseZoom);

        // 指数缩放更顺滑：每级缩放大约变化 12%
        var scale = Math.pow(2, delta);

        if (appState.randomMarkers && appState.randomMarkers.length) {
            appState.randomMarkers.forEach(function (m) {
                applyScaleToMarker(m, scale);
            });
        }

        if (appState.poiMarkers && appState.poiMarkers.length) {
            appState.poiMarkers.forEach(function (m) {
                applyScaleToMarker(m, scale);
            });
        }

    }

    // 对外函数：开启“所有点位随地图缩放”
    function enableMarkersFollowZoom(options) {
        if (!appState.map) return;
        appState.markerScale.enabled = true;
        appState.markerScale.baseZoom = (options && typeof options.baseZoom === 'number')
            ? options.baseZoom
            : MapConfig.mapView.zoom;
        if (options && typeof options.minScale === 'number') appState.markerScale.minScale = options.minScale;
        if (options && typeof options.maxScale === 'number') appState.markerScale.maxScale = options.maxScale;


        if (appState._markerScaleHandler) {
            appState.map.off('zoomend', appState._markerScaleHandler);
        }
        appState._markerScaleHandler = applyAllMarkerScale;
        appState.map.on('zoomend', appState._markerScaleHandler);

        // 初次应用一次，保证当前缩放下立即生效
        applyAllMarkerScale();
    }

    // 点位放置

    function placeMarker(position, options) {
        if (!position) return null;

        var opts = options || {};
        var latlng = Array.isArray(position) ? L.latLng(position[0], position[1]) : position;

        var icon = opts.icon;
        if (!icon && opts.iconUrl) {
            icon = L.icon({
                iconUrl: opts.iconUrl,
                iconSize: opts.iconSize,
                iconAnchor: opts.iconAnchor,
                popupAnchor: opts.popupAnchor
            });
        }

        var marker = L.marker(latlng, icon ? { icon: icon } : undefined);

        if (typeof opts.onClick === 'function') {
            marker.on('click', opts.onClick);
        }

        if (opts.group === 'random') {
            appState.randomMarkers.push(marker);
        } else if (opts.group === 'poi') {
            appState.poiMarkers.push(marker);
        }

        registerScalableMarker(marker);

        if (opts.addToMap && appState.map) {
            marker.addTo(appState.map);
        }

        if (opts.applyScale !== false) {
            applyAllMarkerScale();
        }

        return marker;
    }

    // ==================== 随机点位与抖动 ====================

    // 在指定 bounds 内生成 count 个随机点位
    function createRandomJitterPoints(bounds, count) {
        if (!appState.map || !bounds) return;

        // 清理旧的随机点位
        if (appState.randomMarkers && appState.randomMarkers.length) {
            appState.randomMarkers.forEach(function (m) {
                appState.map.removeLayer(m);
            });
        }
        appState.randomMarkers = [];

        for (var i = 0; i < count; i++) {
            var south = bounds[0][0];
            var west = bounds[0][1];
            var north = bounds[1][0];
            var east = bounds[1][1];

            var lat = south + Math.random() * (north - south);
            var lng = west + Math.random() * (east - west);

            (function (index) {
                placeMarker([lat, lng], {
                    group: 'random',
                    addToMap: true,
                    iconUrl: 'lib/font-awesome/svgs/solid/gift.svg',
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                    popupAnchor: [0, -18],
                    onClick: function () {
                        showPointModal({
                            imageUrl: 'lib/font-awesome/svgs/solid/gift.svg',
                            text: '陕西非遗戏曲博物馆讲解9折优惠'
                        });
                    }
                });
            })(i);
        }
    }


    // 启动随机点位的周期性抖动效果
    function startRandomPointJitter(intervalMs) {
        if (!appState.randomMarkers || !appState.randomMarkers.length) return;

        if (appState.randomJitterTimer) {
            clearInterval(appState.randomJitterTimer);
        }

        var duration = 400; // 单次抖动持续时间（毫秒）
        var interval = intervalMs || 2000;

        appState.randomJitterTimer = setInterval(function () {
            appState.randomMarkers.forEach(function (marker) {
                var el = marker.getElement();
                if (!el) return;
                el.classList.add('random-point-jitter');
                setTimeout(function () {
                    el.classList.remove('random-point-jitter');
                }, duration);
            });
        }, interval);

    }

    // ==================== 核心功能 ====================
    
    // 1. 初始化地图
    function initMap() {
        console.log("初始化地图...");
        updateStatus('mapStatus', 'loading', '初始化地图');
        
        var bound = L.latLngBounds(
            [34.26596164,108.964682],  // 西南角：纬度(lat)、经度(lng)
            [34.26686604,108.966139]   // 东北角：纬度(lat)、经度(lng)
        );

        
        try {
            appState.map = L.map('chinaMap', {
                center: MapConfig.mapView.center,
                zoom: MapConfig.mapView.zoom,
                minZoom: MapConfig.mapView.minZoom,
                maxZoom: MapConfig.mapView.maxZoom,
                attributionControl: false,
                maxBounds: bound, 
                maxBoundsViscosity: 0.8,
                zoomControl: false,
            });
            
            // 添加自定义底图
            L.tileLayer('', {
                attribution: '离线地图系统'
            }).addTo(appState.map);

            
            
            // 添加比例尺
            if (MapConfig.appSettings.showScaleControl) {
                L.control.scale({ 
                    imperial: false, 
                    position: 'bottomleft',
                    maxWidth: 200
                }).addTo(appState.map);
            }
            
            // 创建省份图层组
            appState.provinceLayers = L.layerGroup().addTo(appState.map);

            const imageUrl = 'feature/map.png'; 
            const imageBounds = [
                [34.265803,108.964328], // 西南角
                [34.267131,108.966269],  // 东北角
            ];
            
            const imageCenter = [34.26615,108.96478]

            const imageLayer = L.imageOverlay(imageUrl, imageBounds, {
                opacity: 1, // 图片透明度
                alt: 'Map', 
                interactive: false, // 是否允许交互
                zIndex:200,
            });

            // 3. 将图片图层添加到地图
            imageLayer.addTo(appState.map);

            // 4. 在地图上随机生成 3 个点位，并启动周期性抖动
            createRandomJitterPoints(imageBounds, 3);
            startRandomPointJitter(2500);
            enableMarkersFollowZoom();

            // 5. 添加角色点位
            appState.characterMarker = placeMarker(imageCenter, {
                group: 'poi',
                addToMap: true,
                iconUrl: 'feature/character.png',
                iconSize: [120, 160],
                iconAnchor: [60, 130],
                popupAnchor: [0, -120],
                onClick: function () {
                    openCharacterDialog();
                }
            });


            //创建点位图层
            $.getJSON("data/point.geojson", function(data) {
                L.geoJSON(data, {
                    // 1. 点位转图层（仅显示图标，悬停不再弹出浮窗）
                    pointToLayer: function(feature, latlng) {
                        // 每个点位使用各自文件夹下的图标
                        const src = "feature/" + feature.properties.name + "/img/tooltip.png";
                        console.log(src);

                        return placeMarker(latlng, {
                            group: 'poi',
                            // 这里不能 addToMap，否则会与 geoJSON 图层重复管理
                            addToMap: false,
                            iconUrl: src,
                            iconSize: [60, 80],
                            iconAnchor: [16, 50],
                            popupAnchor: [0, -32]
                        });
                    },
                    // 2. 为每个点位绑定点击事件（悬停仅用于放大图标，由 CSS 控制）
                    onEachFeature: function(feature, layer) {
                        layer.on('click', function(e) {
                            updateSidePanel(feature.properties);
                            $('.info-link').show();
                            $('.info-item').show();
                            completeTaskForFeature(feature.properties);
                        });
                    }
                }).addTo(appState.map);
        });

            
            updateStatus('mapStatus', 'loaded', '地图就绪');
            console.log("✅ 地图初始化完成");
            return true;
        } catch (error) {
            console.error("地图初始化失败:", error);
            updateStatus('mapStatus', 'error', '初始化失败: ' + error.message);
            showError('地图初始化失败: ' + error.message);
            return false;
        }
    }
    
    
    // 3. 加载GeoJSON地图数据
    function loadGeoJson() {
        console.log("加载地图数据...");
        
        return new Promise(function(resolve, reject) {
            $.ajax({
                url: MapConfig.dataFiles.geoJson,
                dataType: 'json',
                success: function(geoJsonData) {
                    // 验证数据
                    if (!geoJsonData || geoJsonData.type !== "FeatureCollection") {
                        throw new Error("无效的GeoJSON格式");
                    }
                    
                    if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
                        throw new Error("缺少features数组");
                    }
                    
                    appState.geoJsonFeatures = geoJsonData.features;
                    console.log("✅ GeoJSON加载成功，共 " + geoJsonData.features.length + " 个区域");
                    
                    // 渲染地图
                    renderMap(geoJsonData);
                    
                    appState.dataLoaded = true;
                    hideLoading();
                    resolve(geoJsonData);
                },
                error: function(xhr, status, error) {
                    var errorMsg = "地图数据加载失败: ";
                    if (xhr.status === 404) {
                        errorMsg += "文件未找到，请确保 geojson 文件存在";
                    } else if (status === "parsererror") {
                        errorMsg += "GeoJSON格式错误";
                    } else {
                        errorMsg += status;
                    }
                    
                    console.error("❌ " + errorMsg);
                    showError(errorMsg);
                    reject(error);
                }
            });
        });
    }
    
    // 4. 渲染地图
    function renderMap(geoJsonData) {
        console.log("渲染地图...");
        
        // 清空现有图层
        if (appState.provinceLayers) {
            appState.provinceLayers.clearLayers();
        }
        
        // 创建GeoJSON图层
        L.geoJSON(geoJsonData, {
            style: MapConfig.styles.default,
            
            onEachFeature: function (feature, layer) {
                // 添加到图层组
                appState.provinceLayers.addLayer(layer);
            }
        });
        
        // 自动适应边界
        if (MapConfig.appSettings.autoFitBounds && geoJsonData.features.length > 0) {
            var bounds = L.geoJSON(geoJsonData).getBounds();
            appState.map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        console.log("✅ 地图渲染完成");
    }

    function LoadMusic(){
        console.log("Loading Music...");
        const bgMusic = document.getElementById('bgMusic');
        const musicBtn = document.getElementById('musicBtn');
        const musicImg = document.getElementById('musicImg');
        // 播放状态标记（初始为暂停）
        let isPlaying = false;
        const play_img="feature/MusicPlay.png";
        const pause_img="feature/MusicPause.png";

        // 音乐播放方法
        function playMusic() {
            bgMusic.play()
            .then(() => {
                isPlaying = true;
                musicImg.src = play_img;
                musicImg.classList.add('rotate');
                musicBtn.classList.add('playing');
            })
            .catch((error) => {
                console.log('音乐播放暂未触发：', error.message);
            });
        }

        // 监听页面首次点击/触摸事件，触发自动播放
        function initAutoPlay() {
            // 触发播放后，立即移除监听（只执行一次）
            function handleFirstInteraction() {
            playMusic();
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
            }
            // 绑定PC端点击、移动端触摸事件
            document.addEventListener('click', handleFirstInteraction);
            document.addEventListener('touchstart', handleFirstInteraction);
        }
        // 页面加载后，初始化自动播放监听
        if(MapConfig.isMusicPlay) initAutoPlay();

        musicBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isPlaying) {
            // 暂停音乐
            bgMusic.pause();
            isPlaying = false;
            musicImg.src = pause_img;
            musicImg.classList.remove('rotate');
            musicBtn.classList.remove('playing');
            } else {
            // 播放音乐
            playMusic();
            }
        });

        // 音乐播放结束后重置状态（关闭loop时生效）
        bgMusic.addEventListener('ended', function() {
            isPlaying = false;
            musicImg.classList.remove('rotate');
            musicBtn.classList.remove('playing');
            // 重新初始化自动播放监听（可选）
            initAutoPlay();
        });
    }
    
    
    // 9. 初始化应用程序
    async function initializeApp() {
        console.log("开始初始化应用程序...");
        
        try {
            // 1. 初始化地图
            if (!initMap()) {
                return;
            }

            // 2. 并行加载数据
            await Promise.all([
                loadGeoJson()
            ]);
            
            // 3.加载音乐
            LoadMusic();

            // 4. 初始化任务栏
            initTasks();
            
            // 5. 完成初始化
            appState.initialized = true;
            console.log("✅ 应用程序初始化完成！");
            
        } catch (error) {
            console.error("❌ 应用程序初始化失败:", error);
            showError("初始化失败: " + error.message);
        }
    }

    //更新侧边栏
    function updateSidePanel(properties) {
        const SiteLink="feature/"+properties.name+"/site/index.html";
        $('#name').text(properties.BM_Name);
        $('#SiteLink').attr('href', SiteLink);
        $('#NevigationLink').attr('href', feature_position[properties.name]);
        $('#provinceName').text(properties.BM_Name);
    }
    
    initializeApp();
    
    window.MapApp = {
        // 重新加载数据
        reloadData: function() {
            if (confirm("确定要重新加载数据吗？")) {
                location.reload();
            }
        },
        
        // 获取应用程序状态
        getStatus: function() {
            return {
                initialized: appState.initialized,
                dataLoaded: appState.dataLoaded,
                provincesCount: appState.geoJsonFeatures.length,
                lastClicked: appState.lastClickedProvinceName
            };
        },
        
        // 手动高亮省份
        highlightProvince: function(provinceName) {
            var layers = appState.provinceLayers.getLayers();
            for (var i = 0; i < layers.length; i++) {
                if (layers[i].provinceName === provinceName) {
                    layers[i].fire('click');
                    break;
                }
            }
        }
    };
});