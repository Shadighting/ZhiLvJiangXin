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
        dataLoaded: false
    };
    
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
    
    // ==================== 核心功能 ====================
    
    // 1. 初始化地图
    function initMap() {
        console.log("初始化地图...");
        updateStatus('mapStatus', 'loading', '初始化地图');
        
        var bound = L.latLngBounds(
            [34.26596164508176,108.96468222141266],  // 西南角：纬度(lat)、经度(lng)
            [34.26686603988667,108.9661386609078]   // 东北角：纬度(lat)、经度(lng)
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

            const imageLayer = L.imageOverlay(imageUrl, imageBounds, {
                opacity: 1, // 图片透明度
                alt: 'Map', 
                interactive: false, // 是否允许交互
                zIndex:200,
            });

            // 3. 将图片图层添加到地图
            imageLayer.addTo(appState.map);


            //创建点位图层
            $.getJSON("data/point.geojson", function(data) {
                L.geoJSON(data, {
                    // 1. 点位转图层（仅显示图标，悬停不再弹出浮窗）
                    pointToLayer: function(feature, latlng) {
                        // 每个点位使用各自文件夹下的图标
                        const src = "feature/" + feature.properties.name + "/img/tooltip.png";
                        console.log(src);

                        const customIcon = L.icon({
                            iconUrl: src,
                            iconSize: [60, 80],
                            iconAnchor: [16, 50],
                            popupAnchor: [0, -32]
                        });

                        const marker = L.marker(latlng, { icon: customIcon });
                        return marker;
                    },
                    // 2. 为每个点位绑定点击事件（悬停仅用于放大图标，由 CSS 控制）
                    onEachFeature: function(feature, layer) {
                        // ========== 自定义点击逻辑 ==========
                        layer.on('click', function(e) {
                            const targetUrl = "feature/" + feature.properties.name + "/site/index.html";
                            updateSidePanel(feature.properties);
                            $('.info-link').show();
                            $('.info-item').show();
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
            
            // 4. 完成初始化
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