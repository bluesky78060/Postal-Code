document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 페이지 로드 시작 - DOMContentLoaded');

    const form = document.getElementById('sampleForm');
    const tableBody = document.getElementById('logTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const dateInput = document.getElementById('date');

    console.log('✅ 기본 요소 로드 완료');

    // ========================================
    // 면적 단위 변환 함수
    // ========================================
    // 1평 = 3.305785 ㎡
    const PYEONG_TO_M2 = 3.305785;

    function convertM2ToPyeong(m2) {
        return (parseFloat(m2) / PYEONG_TO_M2).toFixed(2);
    }

    function convertPyeongToM2(pyeong) {
        return (parseFloat(pyeong) * PYEONG_TO_M2).toFixed(2);
    }

    // ========================================
    // 새로운 UI - 네비게이션 시스템
    // ========================================
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const recordCountEl = document.getElementById('recordCount');
    const emptyParcels = document.getElementById('emptyParcels');

    // 뷰 전환 함수
    function switchView(viewName) {
        views.forEach(view => view.classList.remove('active'));
        navItems.forEach(nav => nav.classList.remove('active'));

        const targetView = document.getElementById(`${viewName}View`);
        const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);

        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        // 목록 뷰로 전환 시 테이블 새로고침
        if (viewName === 'list') {
            renderLogs(sampleLogs);
        }
    }

    // 네비게이션 클릭 이벤트
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.dataset.view;
            switchView(viewName);
        });
    });

    // 빈 상태에서 "새 시료 접수하기" 버튼
    const btnGoForm = document.querySelector('.btn-go-form');
    if (btnGoForm) {
        btnGoForm.addEventListener('click', () => switchView('form'));
    }

    // 빈 필지 상태에서 "첫 번째 필지 추가" 버튼
    const btnAddParcelEmpty = document.querySelector('.btn-add-parcel-empty');
    if (btnAddParcelEmpty) {
        btnAddParcelEmpty.addEventListener('click', () => {
            addParcel();
        });
    }

    // 레코드 카운트 업데이트
    function updateRecordCount() {
        if (recordCountEl) {
            recordCountEl.textContent = `${sampleLogs.length}건`;
        }
    }

    // ========================================
    // 토스트 메시지 시스템
    // ========================================
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.success}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // 3초 후 자동 제거
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 빈 필지 상태 표시/숨김
    function updateEmptyParcelsState() {
        console.log(`📊 updateEmptyParcelsState 호출 - 필지 개수: ${parcels ? parcels.length : 'parcels 정의 안됨'}`);
        if (emptyParcels) {
            if (parcels.length === 0) {
                emptyParcels.style.display = 'block';
                console.log('   - emptyParcels 표시');
            } else {
                emptyParcels.style.display = 'none';
                console.log('   - emptyParcels 숨김');
            }
        } else {
            console.error('❌ emptyParcels 요소를 찾을 수 없습니다!');
        }
    }

    // Purpose (목적) select element
    const purposeSelect = document.getElementById('purpose');

    // ========================================
    // Phone Number Auto Hyphen
    // ========================================
    const phoneNumberInput = document.getElementById('phoneNumber');

    if (phoneNumberInput) {
        phoneNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9]/g, ''); // 숫자만 추출
            let formattedValue = '';

            if (value.length <= 3) {
                formattedValue = value;
            } else if (value.length <= 7) {
                formattedValue = value.slice(0, 3) + '-' + value.slice(3);
            } else if (value.length <= 11) {
                formattedValue = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7);
            } else {
                formattedValue = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
            }

            e.target.value = formattedValue;
        });
    }

    // ========================================
    // Reception Method Selection
    // ========================================
    const receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
    const receptionMethodInput = document.getElementById('receptionMethod');

    receptionMethodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            receptionMethodBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            // Set value to hidden input
            receptionMethodInput.value = btn.dataset.method;
        });
    });

    // ========================================
    // Sample Type Navigation Selection (토양 전용)
    // ========================================
    const sampleTypeBtns = document.querySelectorAll('.sample-type-btn');

    sampleTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            sampleTypeBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            // Switch to form view if not already there
            switchView('form');
        });
    });

    // Address Search Elements
    const searchAddressBtn = document.getElementById('searchAddressBtn');
    const addressPostcode = document.getElementById('addressPostcode');
    const addressRoad = document.getElementById('addressRoad');
    const addressDetail = document.getElementById('addressDetail');
    const addressHidden = document.getElementById('address');

    // 주소 검색 모달 요소
    const addressModal = document.getElementById('addressModal');
    const closeAddressModalBtn = document.getElementById('closeAddressModal');
    const daumPostcodeContainer = document.getElementById('daumPostcodeContainer');

    // 주소 검색 모달 닫기
    function closeAddressModal() {
        addressModal.classList.add('hidden');
        daumPostcodeContainer.innerHTML = ''; // 컨테이너 초기화
    }

    closeAddressModalBtn.addEventListener('click', closeAddressModal);
    addressModal.querySelector('.modal-overlay').addEventListener('click', closeAddressModal);

    // Address Search Handler (Daum Postcode API)
    searchAddressBtn.addEventListener('click', () => {
        console.log('주소 검색 버튼 클릭됨');

        if (typeof daum === 'undefined' || typeof daum.Postcode === 'undefined') {
            alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        // 모달 표시
        addressModal.classList.remove('hidden');
        console.log('주소 검색 모달 표시됨');

        // 이전 내용 초기화
        daumPostcodeContainer.innerHTML = '';

        // 모달 내부에 주소 검색 임베드
        new daum.Postcode({
            oncomplete: function(data) {
                console.log('주소 선택 완료:', data);

                // 도로명 주소
                let roadAddr = data.roadAddress;
                let extraRoadAddr = '';

                // 법정동명이 있을 경우 추가
                if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
                    extraRoadAddr += data.bname;
                }
                // 건물명이 있고, 공동주택일 경우 추가
                if (data.buildingName !== '' && data.apartment === 'Y') {
                    extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
                }
                // 표시할 참고항목이 있을 경우 괄호 추가
                if (extraRoadAddr !== '') {
                    extraRoadAddr = ' (' + extraRoadAddr + ')';
                }

                const finalRoadAddr = roadAddr + extraRoadAddr;
                console.log('입력할 주소 정보:', {
                    우편번호: data.zonecode,
                    도로명주소: finalRoadAddr
                });

                // 우편번호와 주소 정보를 해당 필드에 넣는다.
                addressPostcode.value = data.zonecode;
                addressRoad.value = finalRoadAddr;
                addressDetail.value = ''; // 상세주소 초기화

                console.log('필드 값 설정 완료:', {
                    우편번호필드: addressPostcode.value,
                    도로명주소필드: addressRoad.value,
                    상세주소필드: addressDetail.value
                });

                updateFullAddress();

                // 모달 닫기
                closeAddressModal();
                console.log('주소 검색 모달 닫힘');

                // 상세주소 입력 필드로 포커스
                addressDetail.focus();
            },
            width: '100%',
            height: '100%'
        }).embed(daumPostcodeContainer);
    });

    addressDetail.addEventListener('input', updateFullAddress);

    function updateFullAddress() {
        const postcode = addressPostcode.value;
        const road = addressRoad.value;
        const detail = addressDetail.value;

        if (postcode && road) {
            addressHidden.value = `(${postcode}) ${road}${detail ? ' ' + detail : ''}`;
        } else {
            addressHidden.value = '';
        }
    }

    // Set default date to today
    dateInput.valueAsDate = new Date();

    // Load data from LocalStorage
    let sampleLogs = JSON.parse(localStorage.getItem('sampleLogs')) || [];

    // ========================================
    // 접수번호 자동 카운터
    // ========================================
    const receptionNumberInput = document.getElementById('receptionNumber');

    // 다음 접수번호 생성
    function generateNextReceptionNumber() {
        const year = new Date().getFullYear();
        let maxNumber = 0;

        // 기존 데이터에서 올해 최대 번호 찾기
        // 형식: 2024-001 (기본) 또는 2024-001-1 (서브 번호)
        sampleLogs.forEach(log => {
            if (log.receptionNumber && log.receptionNumber.startsWith(`${year}-`)) {
                const parts = log.receptionNumber.split('-');
                if (parts.length >= 2) {
                    // 두 번째 파트가 기본 번호 (001, 002 등)
                    const num = parseInt(parts[1], 10);
                    if (!isNaN(num) && num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        });

        // 다음 번호 생성 (3자리 패딩)
        const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
        return `${year}-${nextNumber}`;
    }

    // 초기 접수번호 설정
    receptionNumberInput.value = generateNextReceptionNumber();

    // Render initial list
    renderLogs(sampleLogs);

    // ========================================
    // 필지 관리 시스템
    // ========================================
    const parcelsContainer = document.getElementById('parcelsContainer');
    const addParcelBtn = document.getElementById('addParcelBtn');
    const parcelsDataInput = document.getElementById('parcelsData');

    console.log('🗺️ 필지 관리 시스템 초기화');
    console.log(`   - parcelsContainer: ${parcelsContainer ? '✅ 찾음' : '❌ 없음'}`);
    console.log(`   - addParcelBtn: ${addParcelBtn ? '✅ 찾음' : '❌ 없음'}`);

    if (!parcelsContainer) {
        console.error('❌ 치명적 오류: parcelsContainer를 찾을 수 없습니다!');
    }

    let parcels = []; // 필지 배열
    let parcelIdCounter = 0;

    // 필지 추가 버튼
    if (addParcelBtn) {
        addParcelBtn.addEventListener('click', () => {
            addParcel();
        });
    }

    // 초기 필지 1개 추가
    console.log('📝 초기 필지 추가 중...');
    addParcel();

    // 접수번호 변경 시 모든 필지의 번호 업데이트
    receptionNumberInput.addEventListener('input', () => {
        updateAllParcelNumbers();
    });

    // 모든 필지의 번호 업데이트
    function updateAllParcelNumbers() {
        parcels.forEach((parcel, idx) => {
            updateSubLotsDisplay(parcel.id);
            updateCropsAreaDisplay(parcel.id);
        });
    }

    // 필지 추가 함수
    function addParcel() {
        console.log('✨ 필지 추가 함수 호출됨');
        const parcelId = `parcel-${parcelIdCounter++}`;
        const parcel = {
            id: parcelId,
            lotAddress: '',
            subLots: [], // 이제 { lotAddress: string, crops: [{name, area}] } 형태의 객체 배열
            crops: []
        };
        parcels.push(parcel);
        console.log(`   - 생성된 필지 ID: ${parcelId}`);
        console.log(`   - 전체 필지 개수: ${parcels.length}`);

        renderParcelCard(parcel, parcels.length);
        updateParcelsData();
        updateEmptyParcelsState();
    }

    // 필지 카드 렌더링
    function renderParcelCard(parcel, index) {
        console.log(`📍 필지 카드 렌더링 시작: ${parcel.id}, index: ${index}`);

        const card = document.createElement('div');
        card.className = 'parcel-card';
        card.id = parcel.id;

        // 기존 작물 데이터가 있으면 첫 번째 것 사용
        const firstCrop = parcel.crops[0] || { name: '', area: '' };
        const receptionNumber = getReceptionNumber();

        console.log(`   - 첫 번째 작물:`, firstCrop);
        console.log(`   - 접수번호: ${receptionNumber || '(없음)'}`);

        card.innerHTML = `
            <div class="parcel-card-header">
                <h4>필지 ${index}</h4>
                <button type="button" class="btn-remove-parcel" data-id="${parcel.id}">삭제</button>
            </div>
            <div class="parcel-form-grid">
                <div class="parcel-left-column">
                    <div class="parcel-form-group">
                        <label for="lot-address-${parcel.id}">
                            필지 주소 (주 지번) <span class="label-hint">* 리+지번 입력 후 Enter</span>
                        </label>
                        <div class="lot-address-autocomplete-wrapper">
                            <input type="text" class="lot-address-input"
                                   id="lot-address-${parcel.id}"
                                   name="lot-address-${parcel.id}"
                                   data-id="${parcel.id}"
                                   placeholder="예: 문단리 224"
                                   value="${parcel.lotAddress}">
                            <ul class="lot-address-autocomplete-list" id="lotAutocomplete-${parcel.id}"></ul>
                        </div>
                    </div>
                    <div class="crop-area-row">
                        <div class="parcel-form-group">
                            <label for="crop-direct-${parcel.id}">작물명</label>
                            <div class="crop-autocomplete-wrapper">
                                <input type="text" class="crop-direct-input"
                                       id="crop-direct-${parcel.id}"
                                       name="crop-direct-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="예: 고추"
                                       value="${firstCrop.name}">
                                <ul class="crop-autocomplete-list" id="autocomplete-direct-${parcel.id}"></ul>
                            </div>
                        </div>
                        <div class="parcel-form-group">
                            <label for="area-direct-${parcel.id}">면적</label>
                            <div class="area-input-group">
                                <input type="number" class="area-direct-input"
                                       id="area-direct-${parcel.id}"
                                       name="area-direct-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="면적"
                                       value="${firstCrop.area}">
                                <div class="area-unit-toggle" id="area-unit-${parcel.id}" data-id="${parcel.id}" data-unit="m2">
                                    <button type="button" class="unit-btn active" data-value="m2">㎡</button>
                                    <button type="button" class="unit-btn" data-value="pyeong">평</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-add-crop-compact" data-id="${parcel.id}">
                        <span>+</span> 추가 작물
                    </button>
                </div>
                <div class="parcel-right-column">
                    <div class="parcel-form-group">
                        <label for="sub-lot-${parcel.id}">하위 필지</label>
                        <div class="sub-lot-input-wrapper">
                            <div class="lot-address-autocomplete-wrapper">
                                <input type="text" class="sub-lot-input"
                                       id="sub-lot-${parcel.id}"
                                       name="sub-lot-${parcel.id}"
                                       data-id="${parcel.id}"
                                       placeholder="예 : 문단리 123">
                                <ul class="lot-address-autocomplete-list" id="subLotAutocomplete-${parcel.id}"></ul>
                            </div>
                            <button type="button" class="btn-add-sub-lot-icon" data-id="${parcel.id}" title="하위 필지 추가">+</button>
                        </div>
                        <div class="sub-lots-container" id="subLots-${parcel.id}">
                            ${parcel.subLots.map((subLot, idx) => {
                                const number = receptionNumber ? receptionNumber + '-' + (idx + 1) : String(idx + 1);
                                const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
                                const crops = typeof subLot === 'string' ? [] : (subLot.crops || []);
                                const subLotCropsId = 'subLotCrops-' + parcel.id + '-' + idx;
                                return `
                                    <div class="sub-lot-card">
                                        <div class="sub-lot-card-header">
                                            <div class="sub-lot-info">
                                                <span class="sub-lot-number">` + number + `</span>
                                                <span class="sub-lot-value">` + lotAddress + `</span>
                                            </div>
                                            <button type="button" class="remove-sub-lot" data-index="` + idx + `">&times;</button>
                                        </div>
                                        <div class="sub-lot-crops-list" id="` + subLotCropsId + `">
                                            ` + crops.map((crop, cropIdx) => `
                                                <div class="sub-lot-crop-item">
                                                    <span class="crop-name">` + crop.name + `</span>
                                                    <div class="crop-area-info">
                                                        <span class="crop-area">` + crop.area + ` m²</span>
                                                        <button type="button" class="remove-sublot-crop" data-sublot-index="` + idx + `" data-crop-index="` + cropIdx + `">&times;</button>
                                                    </div>
                                                </div>
                                            `).join('') + `
                                        </div>
                                        <button type="button" class="btn-add-sublot-crop" data-parcel-id="` + parcel.id + `" data-sublot-index="` + idx + `">
                                            + 작물 추가
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <div class="parcel-summary" id="summary-${parcel.id}">
                    ${renderParcelSummary(parcel)}
                </div>
            </div>
        `;

        if (!parcelsContainer) {
            console.error('❌ parcelsContainer를 찾을 수 없습니다!');
            return;
        }

        parcelsContainer.appendChild(card);
        console.log(`   ✅ 필지 카드가 DOM에 추가되었습니다`);

        // 직접 입력 자동완성 이벤트 바인딩
        bindDirectCropAutocomplete(parcel.id);
        // 필지 주소 자동완성 이벤트 바인딩
        bindLotAddressAutocomplete(parcel.id);
        // 하위 지번 자동완성 이벤트 바인딩
        bindSubLotAutocomplete(parcel.id);
        // 면적 단위 변환 이벤트 바인딩
        bindAreaUnitConversion(parcel.id);

        console.log(`   ✅ 모든 이벤트 바인딩 완료`);
    }

    // 면적 단위 변환 이벤트 바인딩
    function bindAreaUnitConversion(parcelId) {
        const areaInput = document.getElementById(`area-direct-${parcelId}`);
        const unitToggle = document.getElementById(`area-unit-${parcelId}`);

        if (!areaInput || !unitToggle) return;

        const unitButtons = unitToggle.querySelectorAll('.unit-btn');

        unitButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const currentValue = areaInput.value.trim();
                const newUnit = btn.dataset.value;
                const previousUnit = unitToggle.dataset.unit;

                // 이미 같은 단위면 무시
                if (newUnit === previousUnit) return;

                // 버튼 활성화 상태 변경
                unitButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                unitToggle.dataset.unit = newUnit;

                if (!currentValue || isNaN(currentValue)) {
                    return;
                }

                // 단위 변환
                if (previousUnit === 'm2' && newUnit === 'pyeong') {
                    // ㎡ → 평
                    areaInput.value = convertM2ToPyeong(currentValue);
                } else if (previousUnit === 'pyeong' && newUnit === 'm2') {
                    // 평 → ㎡
                    areaInput.value = convertPyeongToM2(currentValue);
                }
            });
        });
    }

    // 필지 주소 자동완성 바인딩 (봉화군 한정)
    function bindLotAddressAutocomplete(parcelId) {
        const lotInput = document.querySelector(`.lot-address-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`lotAutocomplete-${parcelId}`);

        if (!lotInput || !autocompleteList) return;

        // 입력 시 자동완성 목록 표시
        lotInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            // 이미 완전한 주소면 자동완성 비활성화 (시/군으로 시작)
            if (value.startsWith('봉화군') || value.startsWith('영주시') || value.startsWith('울진군')) {
                autocompleteList.classList.remove('show');
                updateParcelLotAddress(parcelId);
                return;
            }

            if (value.length > 0 && typeof suggestRegionVillages === 'function') {
                const suggestions = suggestRegionVillages(value, ['bonghwa', 'yeongju', 'uljin']);

                if (suggestions.length > 0) {
                    autocompleteList.innerHTML = suggestions.map(item => `
                        <li data-village="${item.village}" data-district="${item.district}" data-region="${item.region}">
                            ${item.displayText}
                        </li>
                    `).join('');
                    autocompleteList.classList.add('show');
                } else {
                    autocompleteList.classList.remove('show');
                }
            } else {
                autocompleteList.classList.remove('show');
            }

            updateParcelLotAddress(parcelId);
        });

        // Enter 키 입력 시 자동 변환
        lotInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();

                const value = lotInput.value.trim();

                // 이미 완전한 주소면 무시 (시/군으로 시작)
                if (value.startsWith('봉화군') || value.startsWith('영주시') || value.startsWith('울진군')) {
                    autocompleteList.classList.remove('show');
                    return;
                }

                // parseParcelAddress 사용 (세 지역 통합)
                if (typeof parseParcelAddress === 'function') {
                    const result = parseParcelAddress(value);

                    if (result) {
                        // 세 지역 간 중복인 경우
                        if (result.isDuplicate) {
                            // 지역 선택 모달 표시
                            showRegionSelectionModal(result, parcelId, lotInput);
                        }
                        // 단일 지역 내 중복인 경우
                        else if (result.alternatives && result.alternatives.length > 1) {
                            // 같은 지역 내 중복 리 선택 UI 표시
                            autocompleteList.innerHTML = result.alternatives.map(district => `
                                <li data-village="${result.village}" data-district="${district}" data-lot="${result.lotNumber}" data-region="${result.region}">
                                    ${result.region} ${district} ${result.village} ${result.lotNumber || ''}
                                </li>
                            `).join('');
                            autocompleteList.classList.add('show');
                        } else {
                            // 단일 매칭 - 바로 변환
                            lotInput.value = result.fullAddress;
                            autocompleteList.classList.remove('show');
                            updateParcelLotAddress(parcelId);
                        }
                    }
                }
            }
        });

        // 자동완성 목록 클릭 시
        autocompleteList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const village = e.target.dataset.village;
                const district = e.target.dataset.district;
                const region = e.target.dataset.region || '봉화군';
                const lotNumber = e.target.dataset.lot || '';

                // 기존 입력에서 지번 추출
                const currentValue = lotInput.value.trim();
                const match = currentValue.match(/(\d+[\d\-]*)$/);
                const extractedLotNumber = lotNumber || (match ? match[1] : '');

                const fullAddress = extractedLotNumber
                    ? `${region} ${district} ${village} ${extractedLotNumber}`
                    : `${region} ${district} ${village}`;

                lotInput.value = fullAddress;
                autocompleteList.classList.remove('show');
                updateParcelLotAddress(parcelId);
            }
        });

        // 포커스 아웃 시 목록 숨김
        lotInput.addEventListener('blur', () => {
            setTimeout(() => {
                autocompleteList.classList.remove('show');
            }, 200);
        });
    }

    // 하위 지번 자동완성 바인딩 (봉화군 한정)
    function bindSubLotAutocomplete(parcelId) {
        const subLotInput = document.querySelector(`.sub-lot-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`subLotAutocomplete-${parcelId}`);

        if (!subLotInput || !autocompleteList) return;

        // 입력 시 자동완성 목록 표시
        subLotInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            // 이미 완전한 주소면 자동완성 비활성화 (시/군으로 시작)
            if (value.startsWith('봉화군') || value.startsWith('영주시') || value.startsWith('울진군')) {
                autocompleteList.classList.remove('show');
                return;
            }

            if (value.length > 0 && typeof suggestRegionVillages === 'function') {
                const suggestions = suggestRegionVillages(value, ['bonghwa', 'yeongju', 'uljin']);

                if (suggestions.length > 0) {
                    autocompleteList.innerHTML = suggestions.map(item => `
                        <li data-village="${item.village}" data-district="${item.district}" data-region="${item.region}">
                            ${item.displayText}
                        </li>
                    `).join('');
                    autocompleteList.classList.add('show');
                } else {
                    autocompleteList.classList.remove('show');
                }
            } else {
                autocompleteList.classList.remove('show');
            }

            // 필지 주소 파싱 시도
            if (value.length > 0) {
                // 완전한 주소가 아닌 경우 자동으로 변환 시도 (시/군으로 시작하지 않음)
                if (!value.startsWith('봉화군') && !value.startsWith('영주시') && !value.startsWith('울진군')) {
                    // parseBonghwaAddress 함수 호출 (있을 경우)
                    if (typeof parseBonghwaAddress === 'function') {
                        const result = parseBonghwaAddress(value);

                        if (result) {
                            // 중복 리인 경우 선택 옵션 제공
                            if (result.alternatives && result.alternatives.length > 1) {
                                // 중복 리 선택 UI 표시
                                autocompleteList.innerHTML = result.alternatives.map(district => `
                                    <li data-village="${result.village}" data-district="${district}" data-region="${result.region}" data-lot="${result.lotNumber}">
                                        ${result.region} ${district} ${result.village} ${result.lotNumber || ''}
                                    </li>
                                `).join('');
                                autocompleteList.classList.add('show');
                            } else {
                                // 단일 매칭 - 바로 변환
                                subLotInput.value = result.fullAddress;
                                autocompleteList.classList.remove('show');
                            }
                        }
                    }
                }
            }
        });

        // 자동완성 목록 클릭 시
        autocompleteList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                const village = e.target.dataset.village;
                const district = e.target.dataset.district;
                const region = e.target.dataset.region || '봉화군';
                const lotNumber = e.target.dataset.lot || '';

                // 기존 입력에서 지번 추출
                const currentValue = subLotInput.value.trim();
                const match = currentValue.match(/(\d+[\d\-]*)$/);
                const extractedLotNumber = lotNumber || (match ? match[1] : '');

                const fullAddress = extractedLotNumber
                    ? `${region} ${district} ${village} ${extractedLotNumber}`
                    : `${region} ${district} ${village}`;

                subLotInput.value = fullAddress;
                autocompleteList.classList.remove('show');
            }
        });

        // 포커스 아웃 시 목록 숨김
        subLotInput.addEventListener('blur', () => {
            setTimeout(() => {
                autocompleteList.classList.remove('show');
            }, 200);
        });
    }

    // 필지 주소 업데이트
    function updateParcelLotAddress(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const lotInput = document.querySelector(`.lot-address-input[data-id="${parcelId}"]`);

        if (parcel && lotInput) {
            parcel.lotAddress = lotInput.value.trim();
            updateParcelsData();
            updateParcelSummary(parcelId);
        }
    }

    // 직접 입력 필드 자동완성 바인딩
    function bindDirectCropAutocomplete(parcelId) {
        console.log('🌾 bindDirectCropAutocomplete called for parcelId:', parcelId);

        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`autocomplete-direct-${parcelId}`);

        console.log('  cropInput:', cropInput);
        console.log('  autocompleteList:', autocompleteList);

        if (!cropInput || !autocompleteList) {
            console.warn('⚠️ Missing elements for parcel', parcelId);
            return;
        }

        cropInput.addEventListener('input', (e) => {
            console.log('✏️ DIRECT CROP INPUT EVENT!', e.target.value);

            const value = e.target.value.trim().toLowerCase();

            if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                const matches = CROP_DATA.filter(crop =>
                    crop.name.toLowerCase().includes(value)
                ).slice(0, 8);

                console.log('🔍 Direct crop matches:', matches.length);

                if (matches.length > 0) {
                    autocompleteList.innerHTML = matches.map(crop => `
                        <li data-code="${crop.code}" data-name="${crop.name}">${crop.name} (${crop.category})</li>
                    `).join('');

                    // 위치 설정
                    const rect = cropInput.getBoundingClientRect();
                    autocompleteList.style.left = `${rect.left}px`;
                    autocompleteList.style.top = `${rect.bottom + 2}px`;
                    autocompleteList.style.width = `${rect.width}px`;

                    autocompleteList.classList.add('show');
                    console.log('✅ Direct crop autocomplete shown at position:', rect);
                } else {
                    autocompleteList.classList.remove('show');
                    console.log('❌ No matches found');
                }
            } else {
                autocompleteList.classList.remove('show');
                console.log('⚠️ Empty value or CROP_DATA unavailable');
            }

            // 첫 번째 작물 업데이트
            updateFirstCrop(parcelId);
        });

        cropInput.addEventListener('blur', () => {
            setTimeout(() => {
                autocompleteList.classList.remove('show');
            }, 200);
        });

        autocompleteList.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
                console.log('🎯 Direct crop item clicked');

                const name = e.target.dataset.name;
                cropInput.value = name;
                autocompleteList.classList.remove('show');
                updateFirstCrop(parcelId);

                // 면적 입력으로 포커스
                const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);
                if (areaInput) areaInput.focus();

                console.log('✅ Direct crop selected:', name);
            }
        });

        console.log('✅ Direct crop autocomplete events bound');
    }

    // 첫 번째 작물 업데이트
    function updateFirstCrop(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);
        const unitSelect = document.getElementById(`area-unit-${parcelId}`);

        if (!parcel || !cropInput || !areaInput) return;

        const cropName = cropInput.value.trim();
        let cropArea = areaInput.value.trim();

        // 단위가 평이면 ㎡로 변환하여 저장
        if (unitSelect && unitSelect.value === 'pyeong' && cropArea) {
            cropArea = convertPyeongToM2(cropArea);
        }

        if (cropName || cropArea) {
            if (parcel.crops.length === 0) {
                parcel.crops.push({ name: cropName, area: cropArea, code: '' });
            } else {
                parcel.crops[0].name = cropName;
                parcel.crops[0].area = cropArea;
            }
        } else if (parcel.crops.length > 0 && !parcel.crops[0].name && !parcel.crops[0].area) {
            // 첫 번째 작물이 비어있고 다른 작물도 없으면 제거
            if (parcel.crops.length === 1) {
                parcel.crops = [];
            }
        }

        updateParcelSummary(parcelId);
        updateParcelsData();
    }

    // 필지 요약 렌더링
    function renderParcelSummary(parcel) {
        // 메인 필지 작물 면적
        const mainArea = parcel.crops.reduce((sum, crop) => sum + (parseFloat(crop.area) || 0), 0);

        // 하위 지번 작물 면적 합산
        const subLotArea = parcel.subLots.reduce((sum, subLot) => {
            if (typeof subLot === 'string') return sum;
            const crops = subLot.crops || [];
            return sum + crops.reduce((s, c) => s + (parseFloat(c.area) || 0), 0);
        }, 0);

        const totalArea = mainArea + subLotArea;
        const mainCropCount = parcel.crops.length;
        const subLotCropCount = parcel.subLots.reduce((sum, subLot) => {
            if (typeof subLot === 'string') return sum;
            return sum + (subLot.crops || []).length;
        }, 0);
        const cropCount = mainCropCount + subLotCropCount;
        const subLotCount = parcel.subLots.length;

        return `
            <div class="summary-item">
                <span>하위 지번:</span>
                <span>${subLotCount}개</span>
            </div>
            <div class="summary-item">
                <span>작물 수:</span>
                <span>${cropCount}개</span>
            </div>
            <div class="summary-item total-area">
                <span>총 면적:</span>
                <span>${totalArea.toLocaleString()} m²</span>
            </div>
        `;
    }

    // 필지 컨테이너 이벤트 위임
    parcelsContainer.addEventListener('click', (e) => {
        const target = e.target;

        // 필지 삭제
        if (target.classList.contains('btn-remove-parcel')) {
            const parcelId = target.dataset.id;
            if (parcels.length > 1) {
                parcels = parcels.filter(p => p.id !== parcelId);
                document.getElementById(parcelId).remove();
                updateParcelNumbers();
                updateParcelsData();
            } else {
                alert('최소 1개의 필지가 필요합니다.');
            }
        }

        // 하위 필지 추가
        if (target.classList.contains('btn-add-sub-lot-icon')) {
            const parcelId = target.dataset.id;
            const input = document.querySelector(`.sub-lot-input[data-id="${parcelId}"]`);
            const value = input.value.trim();
            if (value) {
                const parcel = parcels.find(p => p.id === parcelId);
                // 중복 체크 (문자열/객체 모두 호환)
                const exists = parcel.subLots.some(sl =>
                    (typeof sl === 'string' ? sl : sl.lotAddress) === value
                );
                if (!exists) {
                    parcel.subLots.push({
                        lotAddress: value,
                        crops: []
                    });
                    updateSubLotsDisplay(parcelId);
                    updateParcelSummary(parcelId);
                    updateParcelsData();
                }
                input.value = '';
            }
        }

        // 하위 지번 제거
        if (target.classList.contains('remove-sub-lot')) {
            const subLotIndex = parseInt(target.dataset.index);
            const container = target.closest('.sub-lots-container');
            const parcelId = container.id.replace('subLots-', '');
            const parcel = parcels.find(p => p.id === parcelId);
            parcel.subLots.splice(subLotIndex, 1);
            updateSubLotsDisplay(parcelId);
            updateParcelSummary(parcelId);
            updateParcelsData();
        }

        // 하위 지번 작물 추가 버튼
        if (target.classList.contains('btn-add-sublot-crop')) {
            const parcelId = target.dataset.parcelId;
            const subLotIndex = parseInt(target.dataset.sublotIndex);
            openSubLotCropModal(parcelId, subLotIndex);
        }

        // 하위 지번 작물 제거
        if (target.classList.contains('remove-sublot-crop')) {
            const subLotIndex = parseInt(target.dataset.sublotIndex);
            const cropIndex = parseInt(target.dataset.cropIndex);
            const container = target.closest('.sub-lots-container');
            const parcelId = container.id.replace('subLots-', '');
            const parcel = parcels.find(p => p.id === parcelId);

            if (parcel.subLots[subLotIndex] && parcel.subLots[subLotIndex].crops) {
                parcel.subLots[subLotIndex].crops.splice(cropIndex, 1);
                updateSubLotsDisplay(parcelId);
                updateParcelSummary(parcelId);
                updateParcelsData();
            }
        }

        // 작물 추가 버튼
        if (target.classList.contains('btn-add-crop-area') || target.classList.contains('btn-add-crop-compact')) {
            const parcelId = target.dataset.id;
            openCropAreaModal(parcelId);
        }

        // 작물 제거
        if (target.classList.contains('remove-crop-area')) {
            const item = target.closest('.crop-area-item');
            const container = target.closest('.crops-area-list');
            const parcelId = container.id.replace('cropsArea-', '');
            const index = parseInt(item.dataset.index);
            const parcel = parcels.find(p => p.id === parcelId);
            parcel.crops.splice(index, 1);
            updateCropsAreaDisplay(parcelId);
            updateParcelSummary(parcelId);
            updateParcelsData();
        }
    });

    // 필지 주소 입력 이벤트
    parcelsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('lot-address-input')) {
            const parcelId = e.target.dataset.id;
            const parcel = parcels.find(p => p.id === parcelId);
            parcel.lotAddress = e.target.value;
            updateParcelsData();
        }

        // 직접 면적 입력 이벤트
        if (e.target.classList.contains('area-direct-input')) {
            const parcelId = e.target.dataset.id;
            updateFirstCrop(parcelId);
        }
    });

    // 하위 지번 입력에서 엔터키
    parcelsContainer.addEventListener('keypress', (e) => {
        if (e.target.classList.contains('sub-lot-input') && e.key === 'Enter') {
            e.preventDefault();
            const addBtn = document.querySelector(`.btn-add-sub-lot-icon[data-id="${e.target.dataset.id}"]`);
            addBtn.click();
        }
    });

    // 접수번호 가져오기 (연도 제외, 번호만)
    function getReceptionNumber() {
        const receptionInput = document.getElementById('receptionNumber');
        if (!receptionInput) {
            console.warn('접수번호 입력란을 찾을 수 없습니다');
            return '';
        }

        const value = receptionInput.value.trim();
        if (!value) {
            console.warn('접수번호가 비어있습니다');
            return '';
        }

        // "2024-001" 형식에서 "-" 뒤의 번호만 추출
        const parts = value.split('-');
        if (parts.length >= 2) {
            const numberPart = parts.slice(1).join('-'); // 연도 제외한 나머지 (예: "001" 또는 "001-A")
            console.log(`접수번호 추출: ${value} → ${numberPart}`);
            return numberPart;
        }

        // "-"가 없으면 그대로 반환
        console.log(`접수번호 형식 확인: ${value}`);
        return value;
    }

    // 하위 지번 표시 업데이트
    function updateSubLotsDisplay(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const receptionNumber = getReceptionNumber();
        const container = document.getElementById(`subLots-${parcelId}`);

        // 접수번호가 있으면 접수번호-순번, 없으면 순번만
        container.innerHTML = parcel.subLots.map((subLot, idx) => {
            const number = receptionNumber ? receptionNumber + '-' + (idx + 1) : String(idx + 1);
            const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
            const crops = typeof subLot === 'string' ? [] : (subLot.crops || []);
            const subLotCropsId = 'subLotCrops-' + parcelId + '-' + idx;
            return `
                <div class="sub-lot-card bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-slate-200 dark:border-zinc-700">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="sub-lot-number bg-primary text-white px-2 py-1 rounded text-xs font-bold">` + number + `</span>
                            <span class="sub-lot-value font-medium text-slate-800 dark:text-slate-200">` + lotAddress + `</span>
                        </div>
                        <button type="button" class="remove-sub-lot text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 text-lg" data-index="` + idx + `">&times;</button>
                    </div>
                    <div class="sub-lot-crops-list space-y-1" id="` + subLotCropsId + `">
                        ` + crops.map((crop, cropIdx) => `
                            <div class="flex items-center justify-between bg-white dark:bg-zinc-900 px-2 py-1.5 rounded text-xs">
                                <span class="font-medium text-slate-700 dark:text-slate-300">` + crop.name + `</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-600 dark:text-slate-400">` + crop.area + ` m²</span>
                                    <button type="button" class="remove-sublot-crop text-slate-400 hover:text-red-500 text-sm" data-sublot-index="` + idx + `" data-crop-index="` + cropIdx + `">&times;</button>
                                </div>
                            </div>
                        `).join('') + `
                    </div>
                    <button type="button" class="btn-add-sublot-crop mt-2 w-full text-xs text-primary hover:text-primary-hover font-medium py-1.5 border border-dashed border-primary rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" data-parcel-id="` + parcelId + `" data-sublot-index="` + idx + `">
                        + 작물 추가
                    </button>
                </div>
            `;
        }).join('');
    }

    // 작물 면적 표시 업데이트
    function updateCropsAreaDisplay(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const receptionNumber = getReceptionNumber();
        const container = document.getElementById(`cropsArea-${parcelId}`);

        // 첫 번째 작물은 직접 입력 필드에 표시되므로 slice(1)
        // 접수번호가 있으면 접수번호-순번, 없으면 순번만
        container.innerHTML = parcel.crops.slice(1).map((crop, idx) => {
            const number = receptionNumber ? receptionNumber + '-' + (idx + 2) : String(idx + 2);
            // 지번 정보 표시
            const subLotLabel = getSubLotLabel(crop.subLotTarget, parcel);
            return `
                <div class="crop-area-item" data-index="${idx + 1}">
                    <span class="crop-number">${number}</span>
                    <span class="crop-name">${crop.name}</span>
                    <span class="crop-area">${crop.area} m²</span>
                    ${subLotLabel ? `<span class="crop-sublot">${subLotLabel}</span>` : ''}
                    <button type="button" class="remove-crop-area">&times;</button>
                </div>
            `;
        }).join('');
    }

    // 지번 라벨 생성
    function getSubLotLabel(subLotTarget, parcel) {
        if (!subLotTarget || subLotTarget === 'all') return '';
        if (!parcel.subLots || parcel.subLots.length === 0) return '';

        const idx = parcel.subLots.indexOf(subLotTarget);
        if (idx >= 0) {
            return `[${subLotTarget}]`;
        }
        return '';
    }

    // 필지 요약 업데이트
    function updateParcelSummary(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const summaryEl = document.getElementById(`summary-${parcelId}`);
        summaryEl.innerHTML = renderParcelSummary(parcel);
    }

    // 필지 번호 업데이트
    function updateParcelNumbers() {
        const cards = parcelsContainer.querySelectorAll('.parcel-card');
        cards.forEach((card, idx) => {
            card.querySelector('h4').textContent = `필지 ${idx + 1}`;
        });
    }

    // 필지 데이터를 hidden input에 저장
    function updateParcelsData() {
        parcelsDataInput.value = JSON.stringify(parcels);
    }

    // ========================================
    // 작물+면적 입력 모달
    // ========================================
    const cropAreaModal = document.getElementById('cropAreaModal');
    const cropAreaList = document.getElementById('cropAreaList');
    const addCropAreaBtn = document.getElementById('addCropAreaBtn');
    const confirmCropAreaBtn = document.getElementById('confirmCropAreaBtn');
    const cancelCropAreaBtn = document.getElementById('cancelCropAreaBtn');
    const closeCropAreaModalBtn = document.getElementById('closeCropAreaModal');

    console.log('🔍 Modal elements initialization:');
    console.log('cropAreaModal:', cropAreaModal);
    console.log('cropAreaList:', cropAreaList);
    console.log('addCropAreaBtn:', addCropAreaBtn);
    console.log('CROP_DATA loaded:', typeof CROP_DATA !== 'undefined', CROP_DATA ? CROP_DATA.length : 0);

    let currentParcelIdForCrop = null;
    let tempCropAreas = [];

    function openCropAreaModal(parcelId) {
        console.log('🎯 openCropAreaModal called with parcelId:', parcelId);
        currentParcelIdForCrop = parcelId;
        const parcel = parcels.find(p => p.id === parcelId);
        console.log('📦 Parcel found:', parcel);
        // 기존 작물 데이터에 subLotTarget이 없으면 'all'로 초기화
        tempCropAreas = parcel.crops.map(c => ({
            ...c,
            subLotTarget: c.subLotTarget || 'all'
        }));
        console.log('🌾 tempCropAreas initialized:', tempCropAreas);

        renderCropAreaModal();
        cropAreaModal.classList.remove('hidden');
        console.log('✅ Modal shown, classList:', cropAreaModal.classList.toString());
    }

    // 현재 필지의 지번 옵션 가져오기
    function getSubLotOptions(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        if (!parcel) return [];

        const options = [{ value: 'all', label: '전체 (상위 필지 전체)' }];

        if (parcel.subLots && parcel.subLots.length > 0) {
            parcel.subLots.forEach((lot, idx) => {
                options.push({
                    value: lot,
                    label: `하위 ${idx + 1}: ${lot}`
                });
            });
        }

        return options;
    }

    function closeCropAreaModalFn() {
        cropAreaModal.classList.add('hidden');
        currentParcelIdForCrop = null;
        tempCropAreas = [];
    }

    closeCropAreaModalBtn.addEventListener('click', closeCropAreaModalFn);
    cancelCropAreaBtn.addEventListener('click', closeCropAreaModalFn);
    cropAreaModal.querySelector('.modal-overlay').addEventListener('click', closeCropAreaModalFn);

    // 작물 행 추가
    addCropAreaBtn.addEventListener('click', () => {
        tempCropAreas.push({ name: '', area: '', code: '' });
        renderCropAreaModal();
    });

    // 모달 내 작물 목록 렌더링
    function renderCropAreaModal() {
        console.log('🔧 renderCropAreaModal called');
        console.log('📊 cropAreaList element:', cropAreaList);
        console.log('🌾 tempCropAreas:', tempCropAreas);

        if (tempCropAreas.length === 0) {
            tempCropAreas.push({ name: '', area: '', code: '', subLotTarget: 'all' });
        }

        // 지번 옵션 가져오기
        const subLotOptions = getSubLotOptions(currentParcelIdForCrop);
        const hasSubLots = subLotOptions.length > 1; // 'all' 외에 하위 지번이 있는지

        cropAreaList.innerHTML = tempCropAreas.map((crop, idx) => `
            <div class="crop-area-input-row" data-index="${idx}">
                <div class="crop-select-wrapper crop-autocomplete-wrapper">
                    <input type="text" class="crop-search-input"
                           id="crop-search-${idx}"
                           name="crop-search-${idx}"
                           placeholder="작물명 검색..."
                           value="${crop.name}"
                           data-index="${idx}">
                    <ul class="crop-autocomplete-list" id="autocomplete-${idx}"></ul>
                </div>
                <div class="area-input-wrapper">
                    <input type="number" class="area-input"
                           id="area-input-${idx}"
                           name="area-input-${idx}"
                           placeholder="면적"
                           value="${crop.area}"
                           data-index="${idx}"
                           style="width: 100px;">
                    <select class="area-unit-modal-select"
                            id="area-unit-modal-${idx}"
                            data-index="${idx}"
                            style="width: 60px; padding: 0.625rem 0.5rem; background: var(--gray-50); border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 0.875rem; min-height: 38px;">
                        <option value="m2">㎡</option>
                        <option value="pyeong">평</option>
                    </select>
                </div>
                ${hasSubLots ? `
                <div class="sublot-select-wrapper">
                    <select class="sublot-select"
                            id="sublot-select-${idx}"
                            name="sublot-select-${idx}"
                            data-index="${idx}">
                        ${subLotOptions.map(opt => `
                            <option value="${opt.value}" ${crop.subLotTarget === opt.value ? 'selected' : ''}>
                                ${opt.label}
                            </option>
                        `).join('')}
                    </select>
                </div>
                ` : ''}
                <button type="button" class="btn-remove-row" data-index="${idx}">&times;</button>
            </div>
        `).join('');

        // 자동완성 이벤트 바인딩
        bindAutocompleteEvents();
    }

    // 자동완성 이벤트 바인딩 (간소화된 직접 바인딩 방식)
    function bindAutocompleteEvents() {
        console.log('🔧 bindAutocompleteEvents called');
        console.log('📋 cropAreaList element:', cropAreaList);
        console.log('🌾 CROP_DATA available:', typeof CROP_DATA !== 'undefined', CROP_DATA ? CROP_DATA.length : 0);

        // 작물 검색 input 요소들 찾기
        const searchInputs = cropAreaList.querySelectorAll('.crop-search-input');
        console.log('🔍 Found', searchInputs.length, 'crop search inputs');

        searchInputs.forEach((input, index) => {
            console.log(`  - Input ${index}:`, input, 'data-index:', input.dataset.index);

            // input 이벤트
            input.addEventListener('input', (e) => {
                console.log('✏️ INPUT EVENT FIRED!', e.target.value);

                const idx = parseInt(e.target.dataset.index);
                const value = e.target.value.trim().toLowerCase();
                const autocompleteList = document.getElementById(`autocomplete-${idx}`);

                console.log('📝 Processing input - idx:', idx, 'value:', value, 'list:', autocompleteList);

                tempCropAreas[idx].name = e.target.value;
                tempCropAreas[idx].code = '';

                if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                    const matches = CROP_DATA.filter(crop =>
                        crop.name.toLowerCase().includes(value)
                    ).slice(0, 10);

                    console.log('🔍 Found', matches.length, 'matches');

                    if (matches.length > 0) {
                        autocompleteList.innerHTML = matches.map(crop => `
                            <li data-code="${crop.code}" data-name="${crop.name}">${crop.name} (${crop.category})</li>
                        `).join('');

                        const rect = e.target.getBoundingClientRect();
                        autocompleteList.style.top = `${rect.bottom + 2}px`;
                        autocompleteList.style.left = `${rect.left}px`;
                        autocompleteList.style.width = `${rect.width}px`;

                        autocompleteList.classList.add('show');
                        console.log('✅ Autocomplete shown');
                    } else {
                        autocompleteList.classList.remove('show');
                    }
                } else {
                    autocompleteList.classList.remove('show');
                }
            });

            // blur 이벤트
            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const idx = parseInt(input.dataset.index);
                    const autocompleteList = document.getElementById(`autocomplete-${idx}`);
                    if (autocompleteList) {
                        autocompleteList.classList.remove('show');
                    }
                }, 200);
            });
        });

        // 자동완성 항목 클릭
        const autocompleteLists = cropAreaList.querySelectorAll('.crop-autocomplete-list');
        console.log('🔍 Found', autocompleteLists.length, 'autocomplete lists');

        autocompleteLists.forEach(list => {
            list.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    console.log('🎯 Autocomplete item clicked');

                    const idx = parseInt(list.id.replace('autocomplete-', ''));
                    const name = e.target.dataset.name;
                    const code = e.target.dataset.code;

                    tempCropAreas[idx].name = name;
                    tempCropAreas[idx].code = code;

                    const input = cropAreaList.querySelector(`.crop-search-input[data-index="${idx}"]`);
                    input.value = name;
                    list.classList.remove('show');

                    const areaInput = cropAreaList.querySelector(`.area-input[data-index="${idx}"]`);
                    if (areaInput) areaInput.focus();

                    console.log('✅ Crop selected:', name);
                }
            });
        });

        // 면적 입력 이벤트
        cropAreaList.querySelectorAll('.area-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempCropAreas[idx].area = e.target.value;
            });
        });

        // 면적 단위 변환 이벤트
        cropAreaList.querySelectorAll('.area-unit-modal-select').forEach((select, idx) => {
            // 이전 단위 저장
            let previousUnit = 'm2';

            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const areaInput = document.getElementById(`area-input-${index}`);
                const currentValue = areaInput.value.trim();
                const newUnit = e.target.value;

                if (!currentValue || isNaN(currentValue)) {
                    previousUnit = newUnit;
                    return;
                }

                // 단위 변환
                if (previousUnit === 'm2' && newUnit === 'pyeong') {
                    // ㎡ → 평
                    areaInput.value = convertM2ToPyeong(currentValue);
                } else if (previousUnit === 'pyeong' && newUnit === 'm2') {
                    // 평 → ㎡
                    areaInput.value = convertPyeongToM2(currentValue);
                }

                // tempCropAreas 업데이트
                tempCropAreas[index].area = areaInput.value;
                previousUnit = newUnit;
            });
        });

        // 지번 선택 이벤트
        cropAreaList.querySelectorAll('.sublot-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.index);
                tempCropAreas[idx].subLotTarget = e.target.value;
            });
        });

        // 행 삭제 버튼
        cropAreaList.querySelectorAll('.btn-remove-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                if (tempCropAreas.length > 1) {
                    tempCropAreas.splice(idx, 1);
                    renderCropAreaModal();
                }
            });
        });

        console.log('✅ All event bindings complete');
    }

    // 작물 확인 버튼
    confirmCropAreaBtn.addEventListener('click', () => {
        // 유효한 작물만 저장 (이름과 면적이 있는 것)
        // 평 단위를 ㎡로 변환하여 저장
        const validCrops = tempCropAreas.filter(c => c.name.trim() && c.area).map((crop, idx) => {
            const unitSelect = document.getElementById(`area-unit-modal-${idx}`);
            let area = crop.area;

            // 단위가 평이면 ㎡로 변환
            if (unitSelect && unitSelect.value === 'pyeong') {
                area = convertPyeongToM2(area);
            }

            return {
                ...crop,
                area: area
            };
        });

        const parcel = parcels.find(p => p.id === currentParcelIdForCrop);
        parcel.crops = validCrops;

        updateCropsAreaDisplay(currentParcelIdForCrop);
        updateParcelSummary(currentParcelIdForCrop);
        updateParcelsData();

        closeCropAreaModalFn();
    });

    // ========================================
    // Sub-lot Crop Modal (하위 지번 작물 추가)
    // ========================================
    let currentSubLotParcelId = null;
    let currentSubLotIndex = null;

    function openSubLotCropModal(parcelId, subLotIndex) {
        console.log('🎯 openSubLotCropModal called with parcelId:', parcelId, 'subLotIndex:', subLotIndex);
        currentSubLotParcelId = parcelId;
        currentSubLotIndex = subLotIndex;

        const parcel = parcels.find(p => p.id === parcelId);
        const subLot = parcel.subLots[subLotIndex];
        console.log('📦 Sub-lot found:', subLot);

        // 기존 작물 데이터 로드
        tempCropAreas = subLot.crops && subLot.crops.length > 0
            ? subLot.crops.map(c => ({ ...c }))
            : [{ name: '', area: '', code: '' }];
        console.log('🌾 tempCropAreas for sublot:', tempCropAreas);

        renderCropAreaModal();
        cropAreaModal.classList.remove('hidden');
        console.log('✅ Sublot modal shown, classList:', cropAreaModal.classList.toString());
    }

    // 기존 작물 확인 버튼에 하위 지번 처리 추가
    const originalConfirmHandler = confirmCropAreaBtn.onclick;
    confirmCropAreaBtn.onclick = () => {
        // 하위 지번 작물 추가 모드
        if (currentSubLotParcelId && currentSubLotIndex !== null) {
            const validCrops = tempCropAreas.filter(c => c.name.trim() && c.area);

            const parcel = parcels.find(p => p.id === currentSubLotParcelId);
            if (parcel.subLots[currentSubLotIndex]) {
                // 기존 문자열 형식이면 객체로 변환
                if (typeof parcel.subLots[currentSubLotIndex] === 'string') {
                    const lotAddress = parcel.subLots[currentSubLotIndex];
                    parcel.subLots[currentSubLotIndex] = {
                        lotAddress: lotAddress,
                        crops: []
                    };
                }
                parcel.subLots[currentSubLotIndex].crops = validCrops;
            }

            updateSubLotsDisplay(currentSubLotParcelId);
            updateParcelSummary(currentSubLotParcelId);
            updateParcelsData();

            currentSubLotParcelId = null;
            currentSubLotIndex = null;
            closeCropAreaModalFn();
        }
        // 메인 필지 작물 추가 모드
        else {
            const validCrops = tempCropAreas.filter(c => c.name.trim() && c.area);

            const parcel = parcels.find(p => p.id === currentParcelIdForCrop);
            parcel.crops = validCrops;

            updateCropsAreaDisplay(currentParcelIdForCrop);
            updateParcelSummary(currentParcelIdForCrop);
            updateParcelsData();

            closeCropAreaModalFn();
        }
    };

    // ========================================
    // Form Submit Handler
    // ========================================
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        // 필지 데이터 검증
        const validParcels = parcels.filter(p => p.lotAddress.trim());
        if (validParcels.length === 0) {
            showToast('최소 1개의 필지 주소를 입력해주세요.', 'warning');
            return;
        }

        const formData = new FormData(form);

        // 수정 모드인 경우
        if (editingLogId) {
            const logIndex = sampleLogs.findIndex(l => l.id === editingLogId);
            if (logIndex === -1) {
                showToast('수정할 데이터를 찾을 수 없습니다.', 'error');
                return;
            }

            const existingLog = sampleLogs[logIndex];
            const updatedLog = {
                ...existingLog,
                receptionNumber: formData.get('receptionNumber'),
                date: formData.get('date'),
                name: formData.get('name'),
                phoneNumber: formData.get('phoneNumber'),
                address: formData.get('address'),
                subCategory: formData.get('subCategory') || '-',
                purpose: formData.get('purpose'),
                receptionMethod: formData.get('receptionMethod') || '-',
                note: formData.get('note') || '',
                parcels: validParcels.map(p => ({
                    id: p.id || crypto.randomUUID(),
                    lotAddress: p.lotAddress,
                    subLots: [...p.subLots],
                    crops: p.crops.map(c => ({ ...c }))
                })),
                updatedAt: new Date().toISOString()
            };

            // 호환성을 위한 기존 필드 (첫 번째 필지 기준)
            if (validParcels.length > 0) {
                const firstParcel = validParcels[0];
                updatedLog.lotAddress = firstParcel.lotAddress;
                updatedLog.area = firstParcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0).toString();
                updatedLog.cropsDisplay = firstParcel.crops.map(c => c.name).join(', ') || '-';
            }

            sampleLogs[logIndex] = updatedLog;
            saveLogs();
            renderLogs(sampleLogs);

            // 수정 모드 해제
            cancelEditMode();

            showToast('수정이 완료되었습니다.', 'success');
            switchView('list');
            return;
        }

        // 신규 등록 모드 - 각 필지마다 별도의 접수번호 부여
        const baseReceptionNumber = formData.get('receptionNumber');
        const commonData = {
            date: formData.get('date'),
            name: formData.get('name'),
            phoneNumber: formData.get('phoneNumber'),
            address: formData.get('address'),
            subCategory: formData.get('subCategory') || '-',
            purpose: formData.get('purpose'),
            receptionMethod: formData.get('receptionMethod') || '-',
            note: formData.get('note') || '',
            createdAt: new Date().toISOString()
        };

        // 그룹 ID 생성 (같은 접수건 그룹화용)
        const groupId = crypto.randomUUID();

        // 각 필지별로 별도 레코드 생성
        const newLogs = validParcels.map((parcel, index) => {
            // 첫 번째 필지는 기본 접수번호, 이후는 -1, -2 등 추가
            const receptionNumber = index === 0
                ? baseReceptionNumber
                : `${baseReceptionNumber}-${index}`;

            return {
                id: crypto.randomUUID(),
                receptionNumber,
                ...commonData,
                groupId, // 같은 접수건임을 표시
                parcelIndex: index + 1,
                totalParcels: validParcels.length,
                parcels: [{
                    id: crypto.randomUUID(),
                    lotAddress: parcel.lotAddress,
                    subLots: [...parcel.subLots],
                    crops: parcel.crops.map(c => ({ ...c }))
                }],
                // 호환성을 위한 기존 필드
                lotAddress: parcel.lotAddress,
                area: parcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0).toString(),
                cropsDisplay: parcel.crops.map(c => c.name).join(', ') || '-'
            };
        });

        // 모든 레코드 저장 (역순으로 추가하여 순서 유지)
        newLogs.reverse().forEach(log => sampleLogs.unshift(log));
        saveLogs();
        renderLogs(sampleLogs);
        form.reset();
        dateInput.valueAsDate = new Date();

        // 주소 필드 초기화
        addressPostcode.value = '';
        addressRoad.value = '';
        addressDetail.value = '';
        addressHidden.value = '';

        // 필지 초기화
        parcels = [];
        parcelIdCounter = 0;
        parcelsContainer.innerHTML = '';
        addParcel();

        // 다음 접수번호 자동 생성
        receptionNumberInput.value = generateNextReceptionNumber();

        const parcelCount = newLogs.length;
        showToast(`${parcelCount}건의 시료가 접수되었습니다.`, 'success');

        // 등록 결과 모달 표시 (첫 번째 레코드 기준, 전체 필지 정보 포함)
        const resultData = {
            ...newLogs[newLogs.length - 1], // 첫 번째 접수번호 기준
            parcels: validParcels.map(p => ({
                lotAddress: p.lotAddress,
                subLots: [...p.subLots],
                crops: p.crops.map(c => ({ ...c }))
            })),
            totalRegistered: parcelCount
        };
        showRegistrationResult(resultData);

        switchView('list');
    });

    // Search Handler
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filteredLogs = sampleLogs.filter(log =>
            log.name.toLowerCase().includes(query) ||
            log.receptionNumber.toLowerCase().includes(query)
        );
        renderLogs(filteredLogs);
    });

    // ========================================
    // 수정 모드 관리
    // ========================================
    let editingLogId = null; // 현재 수정 중인 로그 ID

    // 수정 모드 취소 함수
    function cancelEditMode() {
        editingLogId = null;
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '접수 등록';
        submitBtn.classList.remove('btn-edit-mode');

        // 취소 버튼 제거
        const cancelBtn = form.querySelector('.btn-cancel-edit');
        if (cancelBtn) cancelBtn.remove();

        // 폼 초기화
        form.reset();
        subCategorySelect.disabled = true;
        subCategorySelect.innerHTML = '<option value="">상위 카테고리를 먼저 선택하세요</option>';
        dateInput.valueAsDate = new Date();

        // 주소 필드 초기화
        addressPostcode.value = '';
        addressRoad.value = '';
        addressDetail.value = '';
        addressHidden.value = '';

        // 필지 초기화
        parcels = [];
        parcelIdCounter = 0;
        parcelsContainer.innerHTML = '';
        addParcel();

        // 다음 접수번호 자동 생성
        receptionNumberInput.value = generateNextReceptionNumber();
    }

    // 수정할 데이터를 폼에 채우기
    function populateFormForEdit(log) {
        editingLogId = log.id;

        // 기본 필드 채우기
        receptionNumberInput.value = log.receptionNumber || '';
        dateInput.value = log.date || '';
        document.getElementById('name').value = log.name || '';
        document.getElementById('phoneNumber').value = log.phoneNumber || '';

        // 주소 필드 처리
        if (log.address) {
            // 주소 파싱 시도: "(우편번호) 도로명주소 상세주소" 형식
            const addressMatch = log.address.match(/^\((\d{5})\)\s*(.+)$/);
            if (addressMatch) {
                addressPostcode.value = addressMatch[1];
                const roadAndDetail = addressMatch[2];
                // 상세주소 분리 시도 (괄호 뒤의 내용을 상세주소로)
                const detailMatch = roadAndDetail.match(/^(.+?\))\s*(.*)$/);
                if (detailMatch) {
                    addressRoad.value = detailMatch[1];
                    addressDetail.value = detailMatch[2];
                } else {
                    addressRoad.value = roadAndDetail;
                    addressDetail.value = '';
                }
            } else {
                addressRoad.value = log.address;
            }
            addressHidden.value = log.address;
        }

        // 구분 (하위 카테고리) 선택
        const subCategorySelect = document.getElementById('subCategory');
        if (subCategorySelect) {
            subCategorySelect.value = log.subCategory || '';
        }

        // 목적 선택
        if (purposeSelect) {
            purposeSelect.value = log.purpose || '';
        }

        // 수령 방법 선택
        const receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
        receptionMethodBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.method === log.receptionMethod) {
                btn.classList.add('active');
            }
        });
        const receptionMethodInput = document.getElementById('receptionMethod');
        if (receptionMethodInput) {
            receptionMethodInput.value = log.receptionMethod || '';
        }

        // 비고 필드 채우기
        const noteInput = document.getElementById('note');
        if (noteInput) {
            noteInput.value = log.note || '';
        }

        // 필지 데이터 채우기
        parcels = [];
        parcelIdCounter = 0;
        parcelsContainer.innerHTML = '';

        if (log.parcels && log.parcels.length > 0) {
            log.parcels.forEach(parcel => {
                const parcelId = `parcel-${parcelIdCounter++}`;
                const newParcel = {
                    id: parcelId,
                    lotAddress: parcel.lotAddress || '',
                    subLots: parcel.subLots ? [...parcel.subLots] : [],
                    crops: parcel.crops ? parcel.crops.map(c => ({ ...c })) : []
                };
                parcels.push(newParcel);
                renderParcelCard(newParcel, parcels.length);
            });
        } else {
            // 기존 데이터 호환 (parcels 배열이 없는 경우)
            addParcel();
            if (log.lotAddress) {
                parcels[0].lotAddress = log.lotAddress;
                const lotInput = document.querySelector(`.lot-address-input[data-id="${parcels[0].id}"]`);
                if (lotInput) lotInput.value = log.lotAddress;
            }
        }

        updateParcelsData();

        // 버튼 텍스트 변경
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '수정 완료';
        submitBtn.classList.add('btn-edit-mode');

        // 취소 버튼 추가
        if (!form.querySelector('.btn-cancel-edit')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary btn-cancel-edit';
            cancelBtn.textContent = '수정 취소';
            cancelBtn.addEventListener('click', cancelEditMode);
            form.querySelector('.form-actions').appendChild(cancelBtn);
        }

        // 시료 접수 화면으로 전환
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('formView').classList.add('active');

        // 네비게이션 버튼 활성화 상태 변경
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.nav-item[data-view="form"]').classList.add('active');

        // 폼 상단으로 스크롤
        setTimeout(() => {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // Delete & Edit Handler (Event Delegation)
    tableBody.addEventListener('click', (e) => {
        // 완료 버튼
        if (e.target.classList.contains('btn-complete')) {
            const id = e.target.dataset.id;
            const log = sampleLogs.find(l => l.id === id);
            if (log) {
                // 완료 상태 토글
                const newCompletedStatus = !log.completed;

                // 접수번호에서 기본 번호 추출 (예: "2025-001-1" -> "2025-001")
                const receptionNumber = log.receptionNumber || '';
                const baseNumber = receptionNumber.split('-').slice(0, 2).join('-');

                // 같은 기본 번호를 가진 모든 시료 찾기 (하위 필지 포함)
                const relatedLogs = sampleLogs.filter(l => {
                    const logBaseNumber = (l.receptionNumber || '').split('-').slice(0, 2).join('-');
                    return logBaseNumber === baseNumber && baseNumber !== '';
                });

                // 모든 관련 시료의 완료 상태 업데이트
                relatedLogs.forEach(relatedLog => {
                    relatedLog.completed = newCompletedStatus;

                    // 각 행의 UI 업데이트 (동일한 ID를 가진 모든 행을 찾아야 함)
                    const relatedRows = tableBody.querySelectorAll(`tr[data-id="${relatedLog.id}"]`);

                    relatedRows.forEach(relatedRow => {
                        const relatedButton = relatedRow?.querySelector('.btn-complete');

                        if (relatedButton) {
                            if (newCompletedStatus) {
                                relatedRow.classList.add('row-completed');
                                relatedButton.classList.add('completed');
                                relatedButton.textContent = '✔';
                                relatedButton.title = '완료 취소';
                            } else {
                                relatedRow.classList.remove('row-completed');
                                relatedButton.classList.remove('completed');
                                relatedButton.textContent = '';
                                relatedButton.title = '완료';
                            }
                        }
                    });
                });

                saveLogs();

                // 토스트 메시지 (그룹 개수 표시)
                const count = relatedLogs.length;
                if (newCompletedStatus) {
                    showToast(count > 1 ? `${count}개 시료가 완료 처리되었습니다` : '완료 처리되었습니다', 'success');
                } else {
                    showToast(count > 1 ? `${count}개 시료가 완료 취소되었습니다` : '완료 취소되었습니다', 'success');
                }
            }
        }

        // 삭제 버튼
        if (e.target.classList.contains('btn-delete')) {
            const id = e.target.dataset.id;
            if (confirm('정말 삭제하시겠습니까?')) {
                sampleLogs = sampleLogs.filter(log => log.id !== id);
                saveLogs();
                renderLogs(sampleLogs);

                // 삭제한 항목이 수정 중이던 항목이면 수정 모드 취소
                if (editingLogId === id) {
                    cancelEditMode();
                }
            }
        }

        // 수정 버튼
        if (e.target.classList.contains('btn-edit')) {
            const id = e.target.dataset.id;
            const log = sampleLogs.find(l => l.id === id);
            if (log) {
                populateFormForEdit(log);
            }
        }
    });

    // ========================================
    // 기존 작물 검색 모달 기능 (기존 코드 호환)
    // ========================================
    const cropModal = document.getElementById('cropModal');
    const openCropModalBtn = document.getElementById('openCropModalBtn');
    const closeCropModalBtn = document.getElementById('closeCropModal');
    const cropSearchInput = document.getElementById('cropSearchInput');
    const cropCategoryFilter = document.getElementById('cropCategoryFilter');
    const cropList = document.getElementById('cropList');
    const cropResultCount = document.getElementById('cropResultCount');
    const selectedCropTags = document.getElementById('selectedCropTags');
    const selectedCropCount = document.getElementById('selectedCropCount');
    const confirmCropBtn = document.getElementById('confirmCropSelection');
    const cancelCropBtn = document.getElementById('cancelCropSelection');
    const clearCropBtn = document.getElementById('clearCropSelection');

    let tempSelectedCrops = [];
    let confirmedCrops = [];

    // 카테고리 필터 옵션 초기화
    if (typeof CROP_CATEGORIES !== 'undefined' && cropCategoryFilter) {
        CROP_CATEGORIES.forEach(cat => {
            if (cat !== '전체') {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                cropCategoryFilter.appendChild(option);
            }
        });
    }

    // 기존 모달은 숨김 처리 (새 시스템 사용)
    if (openCropModalBtn) {
        openCropModalBtn.style.display = 'none';
    }

    function closeModal() {
        if (cropModal) {
            cropModal.classList.add('hidden');
        }
    }

    if (closeCropModalBtn) closeCropModalBtn.addEventListener('click', closeModal);
    if (cancelCropBtn) cancelCropBtn.addEventListener('click', closeModal);
    if (cropModal) cropModal.querySelector('.modal-overlay').addEventListener('click', closeModal);

    // ========================================
    // Excel Export Handler
    // ========================================
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', () => {
        if (sampleLogs.length === 0) {
            alert('내보낼 데이터가 없습니다.');
            return;
        }

        // 필지별로 행을 펼쳐서 Excel 데이터 생성 (접수 목록과 동일한 방식)
        // 최신 데이터가 아래쪽에 표시되도록 역순 정렬
        const reversedLogs = [...sampleLogs].reverse();
        const excelData = [];

        reversedLogs.forEach(log => {
            if (log.parcels && log.parcels.length > 0) {
                log.parcels.forEach((parcel, pIdx) => {
                    // 메인 필지의 작물 정보
                    const cropsDisplay = parcel.crops && parcel.crops.length > 0
                        ? parcel.crops.map(c => c.name).join(', ')
                        : '-';
                    const totalArea = parcel.crops
                        ? parcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0)
                        : 0;

                    // 메인 필지 행 추가
                    excelData.push({
                        '접수번호': log.receptionNumber,
                        '접수일자': log.date,
                        '구분': log.subCategory || '-',
                        '목적(용도)': log.purpose || '-',
                        '성명': log.name,
                        '주소': log.address,
                        '필지 주소': parcel.lotAddress || '-',
                        '작물': cropsDisplay,
                        '면적(m²)': totalArea > 0 ? totalArea : '-',
                        '전화번호': log.phoneNumber,
                        '수령 방법': log.receptionMethod || '-',
                        '비고': log.note || '-'
                    });

                    // 하위 필지 데이터 추가 (접수 목록과 동일한 방식)
                    if (parcel.subLots && parcel.subLots.length > 0) {
                        parcel.subLots.forEach((subLot, sIdx) => {
                            const subLotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
                            const subLotCrops = typeof subLot === 'string' ? [] : (subLot.crops || []);

                            const subLotCropsDisplay = subLotCrops.length > 0
                                ? subLotCrops.map(c => c.name).join(', ')
                                : '-';
                            const subLotTotalArea = subLotCrops.length > 0
                                ? subLotCrops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0)
                                : 0;

                            excelData.push({
                                '접수번호': `${log.receptionNumber}-${sIdx + 1}`,
                                '접수일자': log.date,
                                '구분': log.subCategory || '-',
                                '목적(용도)': log.purpose || '-',
                                '성명': log.name,
                                '주소': log.address,
                                '필지 주소': subLotAddress,
                                '작물': subLotCropsDisplay,
                                '면적(m²)': subLotTotalArea > 0 ? subLotTotalArea : '-',
                                '전화번호': log.phoneNumber,
                                '수령 방법': log.receptionMethod || '-',
                                '비고': log.note || '-'
                            });
                        });
                    }
                });
            } else {
                // 기존 데이터 호환
                excelData.push({
                    '접수번호': log.receptionNumber,
                    '접수일자': log.date,
                    '구분': log.subCategory || '-',
                    '목적(용도)': log.purpose || '-',
                    '성명': log.name,
                    '주소': log.address,
                    '필지 주소': log.lotAddress || '-',
                    '작물': log.cropsDisplay || '-',
                    '면적(m²)': log.area || '-',
                    '전화번호': log.phoneNumber,
                    '수령 방법': log.receptionMethod || '-',
                    '비고': log.note || '-'
                });
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        ws['!cols'] = [
            { wch: 14 },  // 접수번호
            { wch: 12 },  // 접수일자
            { wch: 8 },   // 구분
            { wch: 12 },  // 목적(용도)
            { wch: 10 },  // 성명
            { wch: 35 },  // 주소
            { wch: 30 },  // 필지 주소
            { wch: 15 },  // 작물
            { wch: 10 },  // 면적
            { wch: 15 },  // 전화번호
            { wch: 10 },  // 수령 방법
            { wch: 20 }   // 비고
        ];

        XLSX.utils.book_append_sheet(wb, ws, '시료접수대장');

        const today = new Date().toISOString().slice(0, 10);
        const filename = `시료접수대장_${today}.xlsx`;

        XLSX.writeFile(wb, filename);
    });

    // ========================================
    // JSON 저장/불러오기 기능
    // ========================================
    const saveJsonBtn = document.getElementById('saveJsonBtn');
    const loadJsonInput = document.getElementById('loadJsonInput');
    const autoSaveToggle = document.getElementById('autoSaveToggle');
    const autoSaveStatus = document.getElementById('autoSaveStatus');

    let autoSaveFileHandle = null;

    saveJsonBtn.addEventListener('click', () => {
        if (sampleLogs.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }

        const dataToSave = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            totalRecords: sampleLogs.length,
            data: sampleLogs
        };

        const jsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const today = new Date().toISOString().slice(0, 10);
        const filename = `시료접수대장_${today}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`${filename} 파일이 저장되었습니다.`);
    });

    loadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const jsonData = JSON.parse(event.target.result);

                let loadedData;
                if (jsonData.data && Array.isArray(jsonData.data)) {
                    loadedData = jsonData.data;
                } else if (Array.isArray(jsonData)) {
                    loadedData = jsonData;
                } else {
                    throw new Error('잘못된 데이터 형식입니다.');
                }

                if (sampleLogs.length > 0) {
                    const choice = confirm(
                        `현재 ${sampleLogs.length}개의 데이터가 있습니다.\n` +
                        `불러온 파일에는 ${loadedData.length}개의 데이터가 있습니다.\n\n` +
                        `확인: 기존 데이터에 추가 (병합)\n` +
                        `취소: 기존 데이터 대체`
                    );

                    if (choice) {
                        const existingIds = new Set(sampleLogs.map(log => log.id));
                        const newLogs = loadedData.filter(log => !existingIds.has(log.id));
                        sampleLogs = [...newLogs, ...sampleLogs];
                    } else {
                        sampleLogs = loadedData;
                    }
                } else {
                    sampleLogs = loadedData;
                }

                saveLogs();
                renderLogs(sampleLogs);
                alert(`${loadedData.length}개의 데이터를 불러왔습니다.`);
            } catch (error) {
                alert('파일을 불러오는데 실패했습니다.\n' + error.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // ========================================
    // 전체화면 뷰어 열기
    // ========================================
    const openViewerBtn = document.getElementById('openViewerBtn');

    if (openViewerBtn) {
        openViewerBtn.addEventListener('click', () => {
            const viewerWindow = window.open('viewer.html', 'DataViewer',
                'width=1400,height=800,scrollbars=yes,resizable=yes');

            if (!viewerWindow) {
                alert('팝업이 차단되었습니다.\n브라우저 설정에서 팝업을 허용해주세요.');
            }
        });
    }

    // ========================================
    // 자동 저장 기능 (File System Access API)
    // ========================================
    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', async () => {
            try {
                // 토글 OFF - 자동저장 비활성화
                if (!autoSaveToggle.checked) {
                    autoSaveFileHandle = null;
                    updateAutoSaveStatus('inactive');
                    return;
                }

                // 토글 ON - 자동저장 활성화
                if (!('showSaveFilePicker' in window)) {
                    alert('이 브라우저는 자동 저장 기능을 지원하지 않습니다.\nChrome, Edge 브라우저를 사용해주세요.');
                    autoSaveToggle.checked = false;
                    return;
                }

                const today = new Date().toISOString().slice(0, 10);
                autoSaveFileHandle = await window.showSaveFilePicker({
                    suggestedName: `시료접수대장_${today}.json`,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });

                updateAutoSaveStatus('active');
                await autoSaveToFile();
                showToast('자동 저장이 활성화되었습니다.', 'success');

            } catch (error) {
                if (error.name === 'AbortError') {
                    // 사용자가 파일 선택을 취소함
                    autoSaveToggle.checked = false;
                    updateAutoSaveStatus('inactive');
                } else {
                    console.error('자동 저장 설정 오류:', error);
                    alert('자동 저장 설정에 실패했습니다.');
                    autoSaveToggle.checked = false;
                    updateAutoSaveStatus('inactive');
                }
            }
        });
    }

    async function autoSaveToFile() {
        if (!autoSaveFileHandle) return;

        try {
            updateAutoSaveStatus('saving');

            const dataToSave = {
                version: '2.0',
                exportDate: new Date().toISOString(),
                totalRecords: sampleLogs.length,
                data: sampleLogs
            };

            const writable = await autoSaveFileHandle.createWritable();
            await writable.write(JSON.stringify(dataToSave, null, 2));
            await writable.close();

            updateAutoSaveStatus('saved');

            setTimeout(() => {
                if (autoSaveFileHandle) {
                    updateAutoSaveStatus('active');
                }
            }, 2000);

        } catch (error) {
            console.error('자동 저장 오류:', error);
            updateAutoSaveStatus('error');
        }
    }

    function updateAutoSaveStatus(status) {
        if (!autoSaveStatus) return;

        const statusDot = autoSaveStatus.querySelector('.status-dot');
        const statusText = autoSaveStatus.querySelector('.status-text');

        autoSaveStatus.classList.remove('hidden', 'active', 'saving', 'error');

        switch (status) {
            case 'active':
                autoSaveStatus.classList.add('active');
                if (statusDot) statusDot.style.background = '#22c55e';
                if (statusText) statusText.textContent = '활성';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'saving':
                autoSaveStatus.classList.add('saving');
                if (statusDot) statusDot.style.background = '#f59e0b';
                if (statusText) statusText.textContent = '저장 중...';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'saved':
                autoSaveStatus.classList.add('active');
                if (statusDot) statusDot.style.background = '#22c55e';
                if (statusText) statusText.textContent = '저장 완료';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'error':
                autoSaveStatus.classList.add('error');
                if (statusDot) statusDot.style.background = '#ef4444';
                if (statusText) statusText.textContent = '저장 실패';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'inactive':
            default:
                if (statusDot) statusDot.style.background = '#9ca3af';
                if (statusText) statusText.textContent = '비활성';
                break;
        }
    }

    // ========================================
    // Helper Functions
    // ========================================
    function saveLogs() {
        localStorage.setItem('sampleLogs', JSON.stringify(sampleLogs));

        if (autoSaveFileHandle) {
            autoSaveToFile();
        }

        sessionStorage.setItem('lastSaveTime', new Date().toISOString());
    }

    // 데이터를 평탄화하여 테이블 행으로 변환 (하위 지번별로 행 분리)
    function flattenLogsForTable(logs) {
        const rows = [];

        logs.forEach(log => {
            if (log.parcels && log.parcels.length > 0) {
                let subLotIndex = 1;

                log.parcels.forEach(parcel => {
                    const cropsDisplay = parcel.crops && parcel.crops.length > 0
                        ? parcel.crops.map(c => c.name).join(', ')
                        : '-';
                    const totalArea = parcel.crops
                        ? parcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0)
                        : 0;

                    // 메인 필지 행 추가
                    rows.push({
                        ...log,
                        _isFirstRow: subLotIndex === 1,
                        _subLotIndex: subLotIndex,
                        _displayNumber: log.receptionNumber,
                        _lotAddress: parcel.lotAddress || '-',
                        _cropsDisplay: cropsDisplay,
                        _areaDisplay: totalArea > 0 ? totalArea.toLocaleString() : '-'
                    });
                    subLotIndex++;

                    // 하위 지번이 있는 경우 각각 별도 행으로 추가 (하위 지번을 필지 주소에 표시)
                    if (parcel.subLots && parcel.subLots.length > 0) {
                        parcel.subLots.forEach((subLot, idx) => {
                            // 문자열/객체 모두 호환
                            const lotAddress = typeof subLot === 'string' ? subLot : subLot.lotAddress;
                            const subLotCrops = typeof subLot === 'string' ? [] : (subLot.crops || []);

                            const subLotCropsDisplay = subLotCrops.length > 0
                                ? subLotCrops.map(c => c.name).join(', ')
                                : '-';
                            const subLotTotalArea = subLotCrops.length > 0
                                ? subLotCrops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0)
                                : 0;

                            rows.push({
                                ...log,
                                _isFirstRow: false,
                                _subLotIndex: subLotIndex,
                                _displayNumber: `${log.receptionNumber}-${idx + 1}`,
                                _lotAddress: lotAddress,
                                _cropsDisplay: subLotCropsDisplay,
                                _areaDisplay: subLotTotalArea > 0 ? subLotTotalArea.toLocaleString() : '-'
                            });
                            subLotIndex++;
                        });
                    }
                });

                // 필지가 없거나 모든 필지에 데이터가 없는 경우 최소 1행
                if (subLotIndex === 1) {
                    rows.push({
                        ...log,
                        _isFirstRow: true,
                        _subLotIndex: 1,
                        _displayNumber: log.receptionNumber,
                        _lotAddress: '-',
                        _subLot: '-',
                        _cropsDisplay: '-',
                        _areaDisplay: '-'
                    });
                }
            } else {
                // 기존 데이터 호환 (parcels 배열이 없는 경우)
                rows.push({
                    ...log,
                    _isFirstRow: true,
                    _subLotIndex: 1,
                    _displayNumber: log.receptionNumber,
                    _lotAddress: log.lotAddress || '-',
                    _subLot: '-',
                    _cropsDisplay: log.cropsDisplay || '-',
                    _areaDisplay: log.area ? parseFloat(log.area).toLocaleString() : '-'
                });
            }
        });

        return rows;
    }

    function renderLogs(logs) {
        tableBody.innerHTML = '';

        // 레코드 카운트 업데이트
        updateRecordCount();

        if (logs.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');

            // 최신 데이터가 아래쪽에 표시되도록 역순 정렬
            const reversedLogs = [...logs].reverse();

            // 데이터 평탄화
            const flatRows = flattenLogsForTable(reversedLogs);
            let rowNum = 1;

            flatRows.forEach((row) => {
                // 하위 카테고리와 재배 작물을 합쳐서 표시
                let subCategoryDisplay = row.subCategory || '';
                if (row._cropsDisplay !== '-') {
                    subCategoryDisplay = subCategoryDisplay
                        ? `${subCategoryDisplay} (${row._cropsDisplay})`
                        : row._cropsDisplay;
                }
                subCategoryDisplay = subCategoryDisplay || '-';

                // 완료 상태 확인
                const isCompleted = row.completed || false;

                const tr = document.createElement('tr');
                tr.className = isCompleted ? 'row-completed' : '';
                // 수령 방법 아이콘 매핑
                const methodIcons = {
                    '우편': '📮',
                    '이메일': '📧',
                    '팩스': '📠',
                    '직접방문': '🚶'
                };
                const methodIcon = methodIcons[row.receptionMethod] || '-';

                tr.dataset.id = row.id;
                tr.innerHTML = `
                    <td class="col-complete">
                        <button class="btn-complete ${isCompleted ? 'completed' : ''}" data-id="${row.id}" title="${isCompleted ? '완료 취소' : '완료'}">
                            ${isCompleted ? '✔' : ''}
                        </button>
                    </td>
                    <td>${row._displayNumber}</td>
                    <td>${row.date}</td>
                    <td>${row.subCategory || '-'}</td>
                    <td>${row.purpose || '-'}</td>
                    <td>${row.name}</td>
                    <td title="${row.address || '-'}">${row.address || '-'}</td>
                    <td title="${row._lotAddress}">${row._lotAddress}</td>
                    <td title="${row._cropsDisplay}">${row._cropsDisplay}</td>
                    <td>${row._areaDisplay}</td>
                    <td>${row.phoneNumber || '-'}</td>
                    <td title="${row.receptionMethod || ''}">${methodIcon}</td>
                    <td class="col-note" title="${row.note || ''}"><div class="note-cell">${row.note || '-'}</div></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-edit" data-id="${row.id}">수정</button>
                            <button class="btn-delete" data-id="${row.id}">삭제</button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }
    }

    // 폼 리셋 시 필지도 초기화
    form.addEventListener('reset', () => {
        setTimeout(() => {
            parcels = [];
            parcelIdCounter = 0;
            parcelsContainer.innerHTML = '';
            addParcel();
        }, 0);
    });

    // ========================================
    // 등록 결과 모달
    // ========================================
    const registrationResultModal = document.getElementById('registrationResultModal');
    const closeRegistrationModal = document.getElementById('closeRegistrationModal');
    const closeResultBtn = document.getElementById('closeResultBtn');
    const exportResultBtn = document.getElementById('exportResultBtn');
    const resultTableBody = document.getElementById('resultTableBody');
    let currentRegistrationData = null;

    function showRegistrationResult(logData) {
        currentRegistrationData = logData;

        // 테이블 데이터 생성
        const rows = [
            { label: '접수번호', value: logData.receptionNumber },
            { label: '접수일자', value: logData.date },
            { label: '성명', value: logData.name },
            { label: '전화번호', value: logData.phoneNumber },
            { label: '주소', value: logData.address || '-' },
            { label: '구분', value: logData.subCategory || '-' },
            { label: '목적 (용도)', value: logData.purpose || '-' },
            { label: '수령 방법', value: logData.receptionMethod || '-' },
            { label: '비고', value: logData.note || '-' }
        ];

        // 필지 정보 추가
        if (logData.parcels && logData.parcels.length > 0) {
            const parcelsHtml = logData.parcels.map((parcel, idx) => {
                const cropsHtml = parcel.crops.length > 0
                    ? `<div class="crop-list">
                        ${parcel.crops.map(crop =>
                            `<span class="crop-tag">${crop.name}: ${crop.area}m²</span>`
                        ).join('')}
                       </div>`
                    : '<span class="text-gray">작물 정보 없음</span>';

                const subLotsText = parcel.subLots.length > 0
                    ? `하위 지번: ${parcel.subLots.join(', ')}`
                    : '';

                return `
                    <div class="parcel-item">
                        <div class="parcel-header">필지 ${idx + 1}</div>
                        <div>${parcel.lotAddress}</div>
                        ${subLotsText ? `<div class="text-sm text-gray">${subLotsText}</div>` : ''}
                        ${cropsHtml}
                    </div>
                `;
            }).join('');

            rows.push({
                label: '필지 정보',
                value: `<div class="parcels-section">${parcelsHtml}</div>`
            });
        }

        // 테이블 생성
        resultTableBody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.label}</td>
                <td>${row.value}</td>
            </tr>
        `).join('');

        // 모달 표시
        registrationResultModal.classList.remove('hidden');
    }

    function closeRegistrationResultModal() {
        registrationResultModal.classList.add('hidden');
        currentRegistrationData = null;
    }

    // 모달 닫기 이벤트
    closeRegistrationModal.addEventListener('click', closeRegistrationResultModal);
    closeResultBtn.addEventListener('click', closeRegistrationResultModal);

    // 오버레이 클릭으로 닫기
    registrationResultModal.querySelector('.modal-overlay').addEventListener('click', closeRegistrationResultModal);

    // 엑셀로 내보내기
    exportResultBtn.addEventListener('click', () => {
        if (!currentRegistrationData) return;

        const excelData = [];

        // 기본 정보
        excelData.push({
            '항목': '접수번호',
            '내용': currentRegistrationData.receptionNumber
        });
        excelData.push({
            '항목': '접수일자',
            '내용': currentRegistrationData.date
        });
        excelData.push({
            '항목': '구분',
            '내용': currentRegistrationData.subCategory || '-'
        });
        excelData.push({
            '항목': '목적 (용도)',
            '내용': currentRegistrationData.purpose || '-'
        });
        excelData.push({
            '항목': '성명',
            '내용': currentRegistrationData.name
        });
        excelData.push({
            '항목': '전화번호',
            '내용': currentRegistrationData.phoneNumber
        });
        excelData.push({
            '항목': '주소',
            '내용': currentRegistrationData.address || '-'
        });
        excelData.push({
            '항목': '수령 방법',
            '내용': currentRegistrationData.receptionMethod || '-'
        });
        excelData.push({
            '항목': '비고',
            '내용': currentRegistrationData.note || '-'
        });

        // 필지 정보
        if (currentRegistrationData.parcels && currentRegistrationData.parcels.length > 0) {
            excelData.push({
                '항목': '',
                '내용': ''
            });
            excelData.push({
                '항목': '=== 필지 정보 ===',
                '내용': ''
            });

            currentRegistrationData.parcels.forEach((parcel, idx) => {
                excelData.push({
                    '항목': `필지 ${idx + 1}`,
                    '내용': parcel.lotAddress
                });

                if (parcel.subLots && parcel.subLots.length > 0) {
                    excelData.push({
                        '항목': '  하위 필지',
                        '내용': parcel.subLots.join(', ')
                    });
                }

                if (parcel.crops && parcel.crops.length > 0) {
                    parcel.crops.forEach(crop => {
                        excelData.push({
                            '항목': '  작물',
                            '내용': `${crop.name} (${crop.area}m²)`
                        });
                    });
                }
            });
        }

        // 엑셀 파일 생성
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        ws['!cols'] = [
            { wch: 20 },
            { wch: 50 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, '등록결과');

        const fileName = `등록결과_${currentRegistrationData.receptionNumber}_${currentRegistrationData.name}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showToast('엑셀 파일로 내보내기 완료', 'success');
    });

    // ========================================
    // 지역 선택 모달 (중복 리 이름)
    // ========================================
    const regionSelectionModal = document.getElementById('regionSelectionModal');
    const closeRegionModal = document.getElementById('closeRegionModal');
    const cancelRegionSelection = document.getElementById('cancelRegionSelection');
    const duplicateVillageName = document.getElementById('duplicateVillageName');
    const regionOptions = document.getElementById('regionOptions');

    let currentRegionSelection = null;

    function showRegionSelectionModal(parseResult, parcelId, inputElement) {
        currentRegionSelection = {
            result: parseResult,
            parcelId,
            inputElement
        };

        // 리 이름 표시
        duplicateVillageName.textContent = parseResult.villageName;

        // 지역 옵션 생성
        regionOptions.innerHTML = parseResult.locations.map((location, index) => `
            <div class="region-option" data-index="${index}">
                <div class="region-option-content">
                    <div class="region-option-title">${location.fullAddress}</div>
                    <div class="region-option-subtitle">${location.region} ${location.district}</div>
                </div>
                <div class="region-option-icon">→</div>
            </div>
        `).join('');

        // 옵션 클릭 이벤트
        regionOptions.querySelectorAll('.region-option').forEach(option => {
            option.addEventListener('click', () => {
                const index = parseInt(option.dataset.index);
                selectRegion(index);
            });
        });

        // 모달 표시
        regionSelectionModal.classList.remove('hidden');
    }

    function selectRegion(index) {
        if (!currentRegionSelection) return;

        const location = currentRegionSelection.result.locations[index];
        const lotNumber = currentRegionSelection.result.lotNumber;
        const fullAddress = lotNumber ? `${location.fullAddress} ${lotNumber}` : location.fullAddress;

        // 입력 필드 업데이트
        currentRegionSelection.inputElement.value = fullAddress;

        // 필지 데이터 업데이트
        updateParcelLotAddress(currentRegionSelection.parcelId);

        // 모달 닫기
        closeRegionSelectionModal();

        showToast('지역이 선택되었습니다', 'success');
    }

    function closeRegionSelectionModal() {
        regionSelectionModal.classList.add('hidden');
        currentRegionSelection = null;
    }

    closeRegionModal.addEventListener('click', closeRegionSelectionModal);
    cancelRegionSelection.addEventListener('click', closeRegionSelectionModal);

    // 오버레이 클릭 시 닫기
    regionSelectionModal.querySelector('.modal-overlay').addEventListener('click', closeRegionSelectionModal);
});
