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

            const imageUrl = 'feature/map.png'; // 本地图片路径
                // 图片的地理边界：[[西南角经纬度], [东北角经纬度]]
                const imageBounds = [
                [34.26596164508176,108.96468222141266], // 西南角：纬度39.78，经度116.20
                [34.26686603988667,108.9661386609078]  // 东北角：纬度40.05，经度116.65
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
                    // 1. 点位转图层
                    pointToLayer: function(feature, latlng) {
                        // 1. 创建图片图标
                        const customIcon = L.icon({
                            iconUrl: "feature/pin.ico" , // 自定义图标路径
                            iconSize: [32, 32], // 图标大小（宽高）
                            iconAnchor: [16, 32], // 锚点（底部中点，对准点位坐标）
                            popupAnchor: [0, -32] // 弹窗相对于图标的偏移（避免遮挡图标）
                        });

                        return L.marker(latlng)
                            .bindPopup(feature.properties.BM_Name);

                        // 2. 创建Marker并传入图片图标
                        // return L.marker(latlng, { icon: customIcon })
                        //     .bindPopup(feature.properties.BM_Name);
                    },
                    // 2.为每个点位绑定点击事件
                    onEachFeature: function(feature, layer) {
                        // ========== 自定义点击逻辑 ==========
                        layer.on('click', function(e) {
                            const targetUrl = "feature/" + feature.properties.name + "/site/index.html";
                            updateSidePanel(feature.properties);
                            $('.info-link').show();
                        });


                        layer.on('mouseover', function() {
                            this.openPopup(); // 打开当前点位的弹窗
                        });
                        layer.on('mouseout', function() {
                            this.closePopup(); // 关闭当前点位的弹窗
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
            
            // 3. 设置初始状态
            resetSidePanel();
            
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
        const linksite="feature/"+properties.name+"/site/index.html";
        $('#name').text(properties.BM_Name);
        $('#SiteLink').attr('href', linksite);
        $('#provinceName').text(properties.BM_Name);
    }
    
    // 10. 重置侧边栏
    function resetSidePanel() {
        $('#provinceName').text(MapConfig.sidePanel.defaultTitle);
        $('#provinceDescription').text(MapConfig.sidePanel.defaultDescription).show();
        $('#provinceShortName').text('-');
        $('#provinceCapital').text('-');
        $('#provinceCode').text('-');
        $('#provinceDetailText').text('点击地图上的点位查看详细信息');
        $('#provinceDetails').show();
        $('.side-panel').removeClass('has-selection');
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