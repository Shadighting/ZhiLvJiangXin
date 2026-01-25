// script.js - 完全离线版本
$(document).ready(function () {
    console.log("🚀 开始初始化离线地图系统...");
    
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
        console.log("🗺️ 初始化地图...");
        updateStatus('mapStatus', 'loading', '初始化地图');
        
        var bound = L.latLngBounds(
            [34.23597,108.941816],  // 西南角：纬度(lat)、经度(lng)
            [34.29799,109.025617]   // 东北角：纬度(lat)、经度(lng)
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
            
            // 添加一个简单的自定义底图（使用Leaflet内置的灰色背景）
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
    
    // 2. 加载省份信息数据
    function loadProvinceInfo() {
        console.log("📚 加载省份信息...");
        updateStatus('dataStatus', 'loading', '加载省份信息');
        
        return new Promise(function(resolve, reject) {
            $.ajax({
                url: MapConfig.dataFiles.provinceInfo,
                dataType: 'json',
                success: function(data) {
                    if (data && typeof data === 'object') {
                        appState.provinceInfoDB = data;
                        console.log("✅ 省份信息加载成功，共 " + Object.keys(data).length + " 个省份");
                        updateStatus('dataStatus', 'loaded', '信息已加载 (' + Object.keys(data).length + '个省份)');
                        resolve(data);
                    } else {
                        throw new Error("数据格式不正确");
                    }
                },
                error: function(xhr, status, error) {
                    var errorMsg = "省份信息加载失败: ";
                    if (xhr.status === 404) {
                        errorMsg += "文件未找到 (404)";
                    } else if (status === "parsererror") {
                        errorMsg += "JSON格式错误";
                    } else {
                        errorMsg += status;
                    }
                    
                    console.warn("⚠️ " + errorMsg);
                    appState.provinceInfoDB = {};
                    updateStatus('dataStatus', 'error', '信息加载失败');
                    
                    // 不是关键错误，继续执行
                    resolve({});
                }
            });
        });
    }
    
    // 3. 加载GeoJSON地图数据
    function loadGeoJson() {
        console.log("🗾 加载地图数据...");
        
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
                        errorMsg += "文件未找到，请确保 provinces.geojson 文件存在";
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
        console.log("🎨 渲染地图...");
        
        // 清空现有图层
        if (appState.provinceLayers) {
            appState.provinceLayers.clearLayers();
        }
        
        // 创建GeoJSON图层
        L.geoJSON(geoJsonData, {
            style: MapConfig.styles.default,
            
            onEachFeature: function (feature, layer) {
                // 获取省份名称
                var provinceName = extractProvinceName(feature);
                
                // 存储信息到图层
                layer.provinceName = provinceName;
                layer.feature = feature;
                
                // 添加到图层组
                appState.provinceLayers.addLayer(layer);
                
                // 绑定事件
                bindLayerEvents(layer, provinceName);
                
                // 添加工具提示
                layer.bindTooltip(provinceName, {
                    permanent: false,
                    direction: 'top',
                    offset: [0, -5],
                    className: 'province-tooltip'
                });
            }
        });
        
        // 自动适应边界
        if (MapConfig.appSettings.autoFitBounds && geoJsonData.features.length > 0) {
            var bounds = L.geoJSON(geoJsonData).getBounds();
            appState.map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        console.log("✅ 地图渲染完成");
    }
    
    // 5. 提取省份名称
    function extractProvinceName(feature) {
        if (!feature.properties) {
            return "未知区域";
        }
        
        // 尝试常见的中文名称字段
        var nameFields = ['name', '名称', 'NAME', '省名', 'province', 'Province', 'CN'];
        
        for (var i = 0; i < nameFields.length; i++) {
            if (feature.properties[nameFields[i]]) {
                return feature.properties[nameFields[i]];
            }
        }
        
        // 尝试第一个属性值
        var props = feature.properties;
        for (var key in props) {
            if (props.hasOwnProperty(key) && props[key]) {
                return props[key];
            }
        }
        
        return "未命名区域";
    }
    
    // 6. 绑定图层事件
    function bindLayerEvents(layer, provinceName) {
        // 悬停事件
        layer.on('mouseover', function (e) {
            if (appState.currentHighlightedLayer !== this) {
                this.setStyle(MapConfig.styles.hover);
                this.bringToFront();
            }
        });
        
        layer.on('mouseout', function (e) {
            if (appState.currentHighlightedLayer !== this) {
                this.setStyle(MapConfig.styles.default);
            }
        });
        
        // 点击事件
        layer.on('click', function (e) {
            // 阻止默认行为
            if (e.originalEvent) {
                e.originalEvent.preventDefault();
            }
            
            // 清除之前的高亮
            if (appState.currentHighlightedLayer && appState.currentHighlightedLayer !== this) {
                appState.currentHighlightedLayer.setStyle(MapConfig.styles.default);
            }
            
            // 高亮当前省份
            this.setStyle(MapConfig.styles.selected);
            this.bringToFront();
            appState.currentHighlightedLayer = this;
            
            // 记录最后点击
            appState.lastClickedProvinceName = provinceName;
            
            // 显示省份信息
            updateProvinceInfo(provinceName);
            
            console.log("📍 点击省份:", provinceName);
        });
    }
    
    // 7. 更新省份信息显示
    function updateProvinceInfo(provinceName) {
        // 获取省份信息
        var info = getProvinceInfo(provinceName);
        
        // 更新UI
        $('#provinceName').text(provinceName);
        $('#provinceShortName').text(info.shortName || '-');
        $('#provinceCapital').text(info.capital || '-');
        $('#provinceCode').text(info.code || '-');
        $('#provinceDetailText').text(info.description || '暂无详细描述');
        
        // 隐藏默认描述
        $('#provinceDescription').hide();
        $('#provinceDetails').show();
        
        // 添加视觉反馈
        $('.side-panel').addClass('has-selection');
    }
    
    // 8. 获取省份信息（智能匹配）
    function getProvinceInfo(geoJsonName) {
        // 尝试直接匹配
        if (appState.provinceInfoDB[geoJsonName]) {
            return appState.provinceInfoDB[geoJsonName];
        }
        
        // 尝试名称映射
        if (MapConfig.nameMapping && MapConfig.nameMapping[geoJsonName]) {
            var mappedName = MapConfig.nameMapping[geoJsonName];
            if (appState.provinceInfoDB[mappedName]) {
                return appState.provinceInfoDB[mappedName];
            }
        }
        
        // 尝试模糊匹配
        var cleanName = geoJsonName.replace(/省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区/g, '');
        for (var key in appState.provinceInfoDB) {
            var cleanKey = key.replace(/省|市|自治区|壮族自治区|回族自治区|维吾尔自治区|特别行政区/g, '');
            if (cleanName === cleanKey || key.includes(cleanName) || cleanName.includes(cleanKey)) {
                return appState.provinceInfoDB[key];
            }
        }
        
        // 返回默认信息
        return {
            shortName: "?",
            capital: "?",
            code: "?",
            description: "该省份的详细信息正在补充中..."
        };
    }
    
    // 9. 初始化应用程序
    async function initializeApp() {
        console.log("⚡ 开始初始化应用程序...");
        
        try {
            // 1. 初始化地图
            if (!initMap()) {
                return;
            }
            
            // 2. 并行加载数据
            await Promise.all([
                loadProvinceInfo(),
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
    
    // 10. 重置侧边栏
    function resetSidePanel() {
        $('#provinceName').text(MapConfig.sidePanel.defaultTitle);
        $('#provinceDescription').text(MapConfig.sidePanel.defaultDescription).show();
        $('#provinceShortName').text('-');
        $('#provinceCapital').text('-');
        $('#provinceCode').text('-');
        $('#provinceDetailText').text('点击地图上的省份查看详细信息');
        $('#provinceDetails').show();
        $('.side-panel').removeClass('has-selection');
    }
    
    // ==================== 启动应用程序 ====================
    initializeApp();
    
    // ==================== 全局API（可选） ====================
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