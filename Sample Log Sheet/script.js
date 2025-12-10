document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('sampleForm');
    const tableBody = document.getElementById('logTableBody');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const dateInput = document.getElementById('date');

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
        if (emptyParcels) {
            if (parcels.length === 0) {
                emptyParcels.style.display = 'block';
            } else {
                emptyParcels.style.display = 'none';
            }
        }
    }

    const subCategorySelect = document.getElementById('subCategory');
    const sampleTypeSelect = document.getElementById('sampleType');

    // Sub-category Data Mapping
    const subCategories = {
        '토양': ['논', '밭', '과수', '시설'],
        '물': ['지하수', '지표수', '호소수'],
        '잔류농약': ['생산물', '작물채', '토양'],
        '가축분뇨퇴비': ['가축분', '액비'],
        '기타': []
    };

    // Handle Sample Type Change
    sampleTypeSelect.addEventListener('change', (e) => {
        const selectedType = e.target.value;
        const options = subCategories[selectedType] || [];

        subCategorySelect.innerHTML = '<option value="">선택하세요</option>';

        if (options.length > 0) {
            subCategorySelect.disabled = false;
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                subCategorySelect.appendChild(option);
            });
        } else {
            subCategorySelect.disabled = true;
            if (selectedType) {
                subCategorySelect.innerHTML = '<option value="">하위 카테고리 없음</option>';
            } else {
                subCategorySelect.innerHTML = '<option value="">상위 카테고리를 먼저 선택하세요</option>';
            }
        }
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
        sampleLogs.forEach(log => {
            if (log.receptionNumber && log.receptionNumber.startsWith(`${year}-`)) {
                const parts = log.receptionNumber.split('-');
                if (parts.length >= 2) {
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

    let parcels = []; // 필지 배열
    let parcelIdCounter = 0;

    // 필지 추가 버튼
    addParcelBtn.addEventListener('click', () => {
        addParcel();
    });

    // 초기 필지 1개 추가
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
        const parcelId = `parcel-${parcelIdCounter++}`;
        const parcel = {
            id: parcelId,
            lotAddress: '',
            subLots: [],
            crops: []
        };
        parcels.push(parcel);
        renderParcelCard(parcel, parcels.length);
        updateParcelsData();
        updateEmptyParcelsState();
    }

    // 필지 카드 렌더링
    function renderParcelCard(parcel, index) {
        const card = document.createElement('div');
        card.className = 'parcel-card';
        card.id = parcel.id;

        // 기존 작물 데이터가 있으면 첫 번째 것 사용
        const firstCrop = parcel.crops[0] || { name: '', area: '' };
        const receptionNumber = getReceptionNumber();

        card.innerHTML = `
            <div class="flex justify-between items-center pb-4 border-b-2 border-slate-200 dark:border-zinc-700 mb-6">
                <div class="flex items-center gap-3">
                    <span class="text-red-500 text-xl">📍</span>
                    <h4 class="text-xl font-bold text-slate-900 dark:text-slate-100">필지 ${index}</h4>
                </div>
                <button type="button" class="btn-remove-parcel bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 text-sm font-semibold py-1.5 px-3 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" data-id="${parcel.id}">삭제</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div class="space-y-6 md:pr-8 md:border-r md:border-slate-200 md:dark:border-zinc-700">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            필지 주소 (주 지번) <span class="text-slate-500 dark:text-slate-400 text-xs">* 리+지번 입력 후 Enter</span>
                        </label>
                        <div class="lot-address-autocomplete-wrapper relative">
                            <input type="text" class="lot-address-input w-full h-[42px] bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-primary focus:border-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                                   data-id="${parcel.id}"
                                   placeholder="예: 문단리 224"
                                   value="${parcel.lotAddress}">
                            <ul class="lot-address-autocomplete-list" id="lotAutocomplete-${parcel.id}"></ul>
                        </div>
                    </div>
                    <div class="grid gap-4" style="grid-template-columns: 2fr 1fr;">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">작물명</label>
                            <div class="crop-autocomplete-wrapper relative">
                                <input type="text" class="crop-direct-input w-full h-[42px] bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-primary focus:border-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                                       data-id="${parcel.id}"
                                       placeholder="예: 고추"
                                       value="${firstCrop.name}">
                                <ul class="crop-autocomplete-list" id="autocomplete-direct-${parcel.id}"></ul>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">면적</label>
                            <div class="relative">
                                <input type="number" class="area-direct-input w-full h-[42px] bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-primary focus:border-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pr-10 px-3 py-2"
                                       data-id="${parcel.id}"
                                       placeholder="면적"
                                       value="${firstCrop.area}">
                                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 dark:text-slate-400 text-sm">m²</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">하위 지번</label>
                        <div class="sub-lot-input-wrapper flex items-center gap-2 mb-3">
                            <div class="lot-address-autocomplete-wrapper relative flex-grow">
                                <input type="text" class="sub-lot-input w-full h-[42px] bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-primary focus:border-primary text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2"
                                       data-id="${parcel.id}"
                                       placeholder="지번 입력 (예: 123-1)">
                                <ul class="lot-address-autocomplete-list" id="subLotAutocomplete-${parcel.id}"></ul>
                            </div>
                            <button type="button" class="btn-add-sub-lot flex-shrink-0 h-[42px] bg-white dark:bg-zinc-800 text-primary font-bold py-2 px-3 rounded-md border-2 border-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-1.5 text-sm" data-id="${parcel.id}">
                                <span class="text-lg">+</span>
                                추가
                            </button>
                        </div>
                        <div class="sub-lots-container flex flex-wrap gap-2" id="subLots-${parcel.id}">
                            ${parcel.subLots.map((lot, idx) => {
                                const number = receptionNumber ? `${receptionNumber}-${idx + 1}` : `${idx + 1}`;
                                return `
                                    <span class="sub-lot-tag inline-flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-md text-sm border border-slate-200 dark:border-zinc-700" data-lot="${lot}" data-index="${idx}">
                                        <span class="sub-lot-number bg-primary text-white px-2 py-0.5 rounded text-xs font-bold">${number}</span>
                                        <span class="sub-lot-value font-medium">${lot}</span>
                                        <button type="button" class="remove-sub-lot text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 text-lg">&times;</button>
                                    </span>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                <div class="parcel-form-group full-width">
                    <div class="crops-area-container" style="margin-top: 0; padding-top: 0; border-top: none;">
                        <div class="crops-area-list" id="cropsArea-${parcel.id}">
                            ${parcel.crops.slice(1).map((crop, idx) => {
                                const number = receptionNumber ? `${receptionNumber}-${idx + 2}` : `${idx + 2}`;
                                return `
                                    <div class="crop-area-item" data-index="${idx + 1}">
                                        <span class="crop-number">${number}</span>
                                        <span class="crop-name">${crop.name}</span>
                                        <span class="crop-area">${crop.area} m²</span>
                                        <button type="button" class="remove-crop-area">&times;</button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <button type="button" class="btn-add-crop-area" data-id="${parcel.id}">+ 추가 작물</button>
                    </div>
                </div>
                <div class="parcel-summary" id="summary-${parcel.id}">
                    ${renderParcelSummary(parcel)}
                </div>
            </div>
        `;
        parcelsContainer.appendChild(card);

        // 직접 입력 자동완성 이벤트 바인딩
        bindDirectCropAutocomplete(parcel.id);
        // 필지 주소 자동완성 이벤트 바인딩
        bindLotAddressAutocomplete(parcel.id);
        // 하위 지번 자동완성 이벤트 바인딩
        bindSubLotAutocomplete(parcel.id);
    }

    // 필지 주소 자동완성 바인딩 (봉화군 한정)
    function bindLotAddressAutocomplete(parcelId) {
        const lotInput = document.querySelector(`.lot-address-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`lotAutocomplete-${parcelId}`);

        if (!lotInput || !autocompleteList) return;

        // 입력 시 자동완성 목록 표시
        lotInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            // 이미 "봉화군"으로 시작하면 자동완성 비활성화
            if (value.startsWith('봉화군')) {
                autocompleteList.classList.remove('show');
                updateParcelLotAddress(parcelId);
                return;
            }

            if (value.length > 0 && typeof suggestBonghwaVillages === 'function') {
                const suggestions = suggestBonghwaVillages(value);

                if (suggestions.length > 0) {
                    autocompleteList.innerHTML = suggestions.map(item => `
                        <li data-village="${item.village}" data-district="${item.district}">
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

                // 이미 "봉화군"으로 시작하면 무시
                if (value.startsWith('봉화군')) {
                    autocompleteList.classList.remove('show');
                    return;
                }

                if (typeof parseBonghwaAddress === 'function') {
                    const result = parseBonghwaAddress(value);

                    if (result) {
                        // 중복 리인 경우 선택 옵션 제공
                        if (result.alternatives && result.alternatives.length > 1) {
                            // 중복 리 선택 UI 표시
                            autocompleteList.innerHTML = result.alternatives.map(district => `
                                <li data-village="${result.village}" data-district="${district}" data-lot="${result.lotNumber}">
                                    봉화군 ${district} ${result.village} ${result.lotNumber || ''}
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
                const lotNumber = e.target.dataset.lot || '';

                // 기존 입력에서 지번 추출
                const currentValue = lotInput.value.trim();
                const match = currentValue.match(/(\d+[\d\-]*)$/);
                const extractedLotNumber = lotNumber || (match ? match[1] : '');

                const fullAddress = extractedLotNumber
                    ? `봉화군 ${district} ${village} ${extractedLotNumber}`
                    : `봉화군 ${district} ${village}`;

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

            // 이미 "봉화군"으로 시작하면 자동완성 비활성화
            if (value.startsWith('봉화군')) {
                autocompleteList.classList.remove('show');
                return;
            }

            if (value.length > 0 && typeof suggestBonghwaVillages === 'function') {
                const suggestions = suggestBonghwaVillages(value);

                if (suggestions.length > 0) {
                    autocompleteList.innerHTML = suggestions.map(item => `
                        <li data-village="${item.village}" data-district="${item.district}">
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
                // 봉화군으로 시작하지 않는 경우 자동으로 변환 시도
                if (!value.startsWith('봉화군')) {
                    // parseBonghwaAddress 함수 호출 (있을 경우)
                    if (typeof parseBonghwaAddress === 'function') {
                        const result = parseBonghwaAddress(value);

                        if (result) {
                            // 중복 리인 경우 선택 옵션 제공
                            if (result.alternatives && result.alternatives.length > 1) {
                                // 중복 리 선택 UI 표시
                                autocompleteList.innerHTML = result.alternatives.map(district => `
                                    <li data-village="${result.village}" data-district="${district}" data-lot="${result.lotNumber}">
                                        봉화군 ${district} ${result.village} ${result.lotNumber || ''}
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
                const lotNumber = e.target.dataset.lot || '';

                // 기존 입력에서 지번 추출
                const currentValue = subLotInput.value.trim();
                const match = currentValue.match(/(\d+[\d\-]*)$/);
                const extractedLotNumber = lotNumber || (match ? match[1] : '');

                const fullAddress = extractedLotNumber
                    ? `봉화군 ${district} ${village} ${extractedLotNumber}`
                    : `봉화군 ${district} ${village}`;

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
        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const autocompleteList = document.getElementById(`autocomplete-direct-${parcelId}`);

        if (!cropInput || !autocompleteList) return;

        cropInput.addEventListener('input', (e) => {
            const value = e.target.value.trim().toLowerCase();

            if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                const matches = CROP_DATA.filter(crop =>
                    crop.name.toLowerCase().includes(value)
                ).slice(0, 8);

                if (matches.length > 0) {
                    autocompleteList.innerHTML = matches.map(crop => `
                        <li data-code="${crop.code}" data-name="${crop.name}">${crop.name} (${crop.category})</li>
                    `).join('');
                    autocompleteList.classList.add('show');
                } else {
                    autocompleteList.classList.remove('show');
                }
            } else {
                autocompleteList.classList.remove('show');
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
                const name = e.target.dataset.name;
                cropInput.value = name;
                autocompleteList.classList.remove('show');
                updateFirstCrop(parcelId);

                // 면적 입력으로 포커스
                const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);
                if (areaInput) areaInput.focus();
            }
        });
    }

    // 첫 번째 작물 업데이트
    function updateFirstCrop(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const cropInput = document.querySelector(`.crop-direct-input[data-id="${parcelId}"]`);
        const areaInput = document.querySelector(`.area-direct-input[data-id="${parcelId}"]`);

        if (!parcel || !cropInput || !areaInput) return;

        const cropName = cropInput.value.trim();
        const cropArea = areaInput.value.trim();

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
        const totalArea = parcel.crops.reduce((sum, crop) => sum + (parseFloat(crop.area) || 0), 0);
        const cropCount = parcel.crops.length;
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

        // 하위 지번 추가
        if (target.classList.contains('btn-add-sub-lot')) {
            const parcelId = target.dataset.id;
            const input = document.querySelector(`.sub-lot-input[data-id="${parcelId}"]`);
            const value = input.value.trim();
            if (value) {
                const parcel = parcels.find(p => p.id === parcelId);
                if (!parcel.subLots.includes(value)) {
                    parcel.subLots.push(value);
                    updateSubLotsDisplay(parcelId);
                    updateParcelSummary(parcelId);
                    updateParcelsData();
                }
                input.value = '';
            }
        }

        // 하위 지번 제거
        if (target.classList.contains('remove-sub-lot')) {
            const tag = target.closest('.sub-lot-tag');
            const lot = tag.dataset.lot;
            const container = target.closest('.sub-lots-container');
            const parcelId = container.id.replace('subLots-', '');
            const parcel = parcels.find(p => p.id === parcelId);
            parcel.subLots = parcel.subLots.filter(l => l !== lot);
            tag.remove();
            updateParcelSummary(parcelId);
            updateParcelsData();
        }

        // 작물 추가 버튼
        if (target.classList.contains('btn-add-crop-area')) {
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
            const addBtn = document.querySelector(`.btn-add-sub-lot[data-id="${e.target.dataset.id}"]`);
            addBtn.click();
        }
    });

    // 접수번호 가져오기 (연도 제외, 번호만)
    function getReceptionNumber() {
        const receptionInput = document.getElementById('receptionNumber');
        if (!receptionInput) return '';

        const value = receptionInput.value.trim();
        if (!value) return '';

        // "2024-001" 형식에서 "-" 뒤의 번호만 추출
        const parts = value.split('-');
        if (parts.length >= 2) {
            return parts.slice(1).join('-'); // 연도 제외한 나머지 (예: "001" 또는 "001-A")
        }
        return value; // "-"가 없으면 그대로 반환
    }

    // 하위 지번 표시 업데이트
    function updateSubLotsDisplay(parcelId) {
        const parcel = parcels.find(p => p.id === parcelId);
        const receptionNumber = getReceptionNumber();
        const container = document.getElementById(`subLots-${parcelId}`);

        // 접수번호가 있으면 접수번호-순번, 없으면 순번만
        container.innerHTML = parcel.subLots.map((lot, idx) => {
            const number = receptionNumber ? `${receptionNumber}-${idx + 1}` : `${idx + 1}`;
            return `
                <span class="sub-lot-tag" data-lot="${lot}" data-index="${idx}">
                    <span class="sub-lot-number">${number}</span>
                    <span class="sub-lot-value">${lot}</span>
                    <button type="button" class="remove-sub-lot">&times;</button>
                </span>
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
            const number = receptionNumber ? `${receptionNumber}-${idx + 2}` : `${idx + 2}`;
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

    let currentParcelIdForCrop = null;
    let tempCropAreas = [];

    function openCropAreaModal(parcelId) {
        currentParcelIdForCrop = parcelId;
        const parcel = parcels.find(p => p.id === parcelId);
        // 기존 작물 데이터에 subLotTarget이 없으면 'all'로 초기화
        tempCropAreas = parcel.crops.map(c => ({
            ...c,
            subLotTarget: c.subLotTarget || 'all'
        }));

        renderCropAreaModal();
        cropAreaModal.classList.remove('hidden');
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
                           placeholder="작물명 검색..."
                           value="${crop.name}"
                           data-index="${idx}">
                    <ul class="crop-autocomplete-list" id="autocomplete-${idx}"></ul>
                </div>
                <div class="area-input-wrapper">
                    <input type="number" class="area-input"
                           placeholder="면적"
                           value="${crop.area}"
                           data-index="${idx}">
                    <span>m²</span>
                </div>
                ${hasSubLots ? `
                <div class="sublot-select-wrapper">
                    <select class="sublot-select" data-index="${idx}">
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

    // 자동완성 이벤트 바인딩
    function bindAutocompleteEvents() {
        const searchInputs = cropAreaList.querySelectorAll('.crop-search-input');
        console.log('bindAutocompleteEvents called, found inputs:', searchInputs.length);
        console.log('CROP_DATA available:', typeof CROP_DATA !== 'undefined', CROP_DATA ? CROP_DATA.length : 0);

        searchInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const value = e.target.value.trim().toLowerCase();
                const autocompleteList = document.getElementById(`autocomplete-${idx}`);

                console.log('Input event:', value, 'autocompleteList found:', !!autocompleteList);

                tempCropAreas[idx].name = e.target.value;
                tempCropAreas[idx].code = '';

                if (value.length > 0 && typeof CROP_DATA !== 'undefined') {
                    const matches = CROP_DATA.filter(crop =>
                        crop.name.toLowerCase().includes(value)
                    ).slice(0, 10);

                    console.log('Matches found:', matches.length);

                    if (matches.length > 0) {
                        autocompleteList.innerHTML = matches.map(crop => `
                            <li data-code="${crop.code}" data-name="${crop.name}">${crop.name} (${crop.category})</li>
                        `).join('');
                        autocompleteList.classList.add('show');
                        console.log('Autocomplete list shown');
                    } else {
                        autocompleteList.classList.remove('show');
                    }
                } else {
                    autocompleteList.classList.remove('show');
                    console.log('No search value or CROP_DATA not available');
                }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    const idx = parseInt(input.dataset.index);
                    const autocompleteList = document.getElementById(`autocomplete-${idx}`);
                    autocompleteList.classList.remove('show');
                }, 200);
            });
        });

        // 자동완성 항목 클릭
        cropAreaList.querySelectorAll('.crop-autocomplete-list').forEach(list => {
            list.addEventListener('click', (e) => {
                if (e.target.tagName === 'LI') {
                    const idx = parseInt(list.id.replace('autocomplete-', ''));
                    const name = e.target.dataset.name;
                    const code = e.target.dataset.code;

                    tempCropAreas[idx].name = name;
                    tempCropAreas[idx].code = code;

                    const input = cropAreaList.querySelector(`.crop-search-input[data-index="${idx}"]`);
                    input.value = name;
                    list.classList.remove('show');

                    // 면적 입력으로 포커스
                    const areaInput = cropAreaList.querySelector(`.area-input[data-index="${idx}"]`);
                    areaInput.focus();
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
    }

    // 작물 확인 버튼
    confirmCropAreaBtn.addEventListener('click', () => {
        // 유효한 작물만 저장 (이름과 면적이 있는 것)
        const validCrops = tempCropAreas.filter(c => c.name.trim() && c.area);

        const parcel = parcels.find(p => p.id === currentParcelIdForCrop);
        parcel.crops = validCrops;

        updateCropsAreaDisplay(currentParcelIdForCrop);
        updateParcelSummary(currentParcelIdForCrop);
        updateParcelsData();

        closeCropAreaModalFn();
    });

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
                sampleType: formData.get('sampleType'),
                subCategory: formData.get('subCategory') || '-',
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

        // 신규 등록 모드
        const newLog = {
            id: crypto.randomUUID(),
            receptionNumber: formData.get('receptionNumber'),
            date: formData.get('date'),
            name: formData.get('name'),
            phoneNumber: formData.get('phoneNumber'),
            address: formData.get('address'),
            sampleType: formData.get('sampleType'),
            subCategory: formData.get('subCategory') || '-',
            parcels: validParcels.map(p => ({
                id: crypto.randomUUID(),
                lotAddress: p.lotAddress,
                subLots: [...p.subLots],
                crops: p.crops.map(c => ({ ...c }))
            })),
            createdAt: new Date().toISOString()
        };

        // 호환성을 위한 기존 필드 (첫 번째 필지 기준)
        if (validParcels.length > 0) {
            const firstParcel = validParcels[0];
            newLog.lotAddress = firstParcel.lotAddress;
            newLog.area = firstParcel.crops.reduce((sum, c) => sum + (parseFloat(c.area) || 0), 0).toString();
            newLog.cropsDisplay = firstParcel.crops.map(c => c.name).join(', ') || '-';
        }

        sampleLogs.unshift(newLog);
        saveLogs();
        renderLogs(sampleLogs);
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

        showToast('접수가 완료되었습니다.', 'success');

        // 등록 결과 모달 표시
        showRegistrationResult(newLog);

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

        // 시료종류 선택
        sampleTypeSelect.value = log.sampleType || '';

        // 하위 카테고리 업데이트
        if (log.sampleType) {
            const options = subCategories[log.sampleType] || [];
            subCategorySelect.innerHTML = '<option value="">선택하세요</option>';
            if (options.length > 0) {
                subCategorySelect.disabled = false;
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    subCategorySelect.appendChild(option);
                });
                subCategorySelect.value = log.subCategory || '';
            } else {
                subCategorySelect.disabled = true;
                subCategorySelect.innerHTML = '<option value="">하위 카테고리 없음</option>';
            }
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

        // 폼 상단으로 스크롤
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Delete & Edit Handler (Event Delegation)
    tableBody.addEventListener('click', (e) => {
        // 완료 버튼
        if (e.target.classList.contains('btn-complete')) {
            const id = e.target.dataset.id;
            const log = sampleLogs.find(l => l.id === id);
            if (log) {
                // 완료 상태 토글
                log.completed = !log.completed;
                saveLogs();

                // 해당 행만 업데이트
                const row = tableBody.querySelector(`tr[data-id="${id}"]`);
                const button = e.target;

                if (log.completed) {
                    row.classList.add('row-completed');
                    button.classList.add('completed');
                    button.textContent = '✓';
                    button.title = '완료 취소';
                    showToast('완료 처리되었습니다', 'success');
                } else {
                    row.classList.remove('row-completed');
                    button.classList.remove('completed');
                    button.textContent = '○';
                    button.title = '완료';
                    showToast('완료 취소되었습니다', 'success');
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

        // 필지별로 행을 펼쳐서 Excel 데이터 생성
        const excelData = [];
        sampleLogs.forEach(log => {
            if (log.parcels && log.parcels.length > 0) {
                log.parcels.forEach((parcel, pIdx) => {
                    if (parcel.crops && parcel.crops.length > 0) {
                        parcel.crops.forEach((crop, cIdx) => {
                            excelData.push({
                                '접수번호': log.receptionNumber,
                                '접수일자': log.date,
                                '성명': log.name,
                                '전화번호': log.phoneNumber,
                                '주소': log.address,
                                '시료종류': log.sampleType,
                                '형태': log.subCategory || '-',
                                '필지 주소': parcel.lotAddress,
                                '하위 지번': parcel.subLots.join(', ') || '-',
                                '작물': crop.name,
                                '면적(m²)': crop.area
                            });
                        });
                    } else {
                        excelData.push({
                            '접수번호': log.receptionNumber,
                            '접수일자': log.date,
                            '성명': log.name,
                            '전화번호': log.phoneNumber,
                            '주소': log.address,
                            '시료종류': log.sampleType,
                            '형태': log.subCategory || '-',
                            '필지 주소': parcel.lotAddress,
                            '하위 지번': parcel.subLots.join(', ') || '-',
                            '작물': '-',
                            '면적(m²)': '-'
                        });
                    }
                });
            } else {
                // 기존 데이터 호환
                excelData.push({
                    '접수번호': log.receptionNumber,
                    '접수일자': log.date,
                    '성명': log.name,
                    '전화번호': log.phoneNumber,
                    '주소': log.address,
                    '시료종류': log.sampleType,
                    '형태': log.subCategory || '-',
                    '필지 주소': log.lotAddress || '-',
                    '하위 지번': '-',
                    '작물': log.cropsDisplay || '-',
                    '면적(m²)': log.area || '-'
                });
            }
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        ws['!cols'] = [
            { wch: 12 },  // 접수번호
            { wch: 12 },  // 접수일자
            { wch: 10 },  // 성명
            { wch: 15 },  // 전화번호
            { wch: 30 },  // 주소
            { wch: 12 },  // 시료종류
            { wch: 10 },  // 형태
            { wch: 30 },  // 필지 주소
            { wch: 20 },  // 하위 지번
            { wch: 15 },  // 작물
            { wch: 10 }   // 면적
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
    const autoSaveSetupBtn = document.getElementById('autoSaveSetupBtn');
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
    if (autoSaveSetupBtn) {
        autoSaveSetupBtn.addEventListener('click', async () => {
        try {
            if (!('showSaveFilePicker' in window)) {
                alert('이 브라우저는 자동 저장 기능을 지원하지 않습니다.\nChrome, Edge 브라우저를 사용해주세요.');
                return;
            }

            if (autoSaveFileHandle) {
                autoSaveFileHandle = null;
                autoSaveSetupBtn.textContent = '⚙️ 자동저장 설정';
                autoSaveSetupBtn.classList.remove('active');
                updateAutoSaveStatus('inactive');
                alert('자동 저장이 비활성화되었습니다.');
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

            autoSaveSetupBtn.textContent = '✅ 자동저장 활성';
            autoSaveSetupBtn.classList.add('active');
            updateAutoSaveStatus('active');

            await autoSaveToFile();
            alert('자동 저장이 활성화되었습니다.\n데이터 변경 시 자동으로 저장됩니다.');

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('자동 저장 설정 오류:', error);
                alert('자동 저장 설정에 실패했습니다.');
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
        const statusIcon = autoSaveStatus.querySelector('.status-icon');
        const statusText = autoSaveStatus.querySelector('.status-text');

        autoSaveStatus.classList.remove('hidden', 'active', 'saving', 'error');

        switch (status) {
            case 'active':
                autoSaveStatus.classList.add('active');
                statusIcon.textContent = '●';
                statusText.textContent = '자동저장 활성';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'saving':
                autoSaveStatus.classList.add('saving');
                statusIcon.textContent = '○';
                statusText.textContent = '저장 중...';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'saved':
                autoSaveStatus.classList.add('active');
                statusIcon.textContent = '✓';
                statusText.textContent = '저장 완료';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'error':
                autoSaveStatus.classList.add('error');
                statusIcon.textContent = '✕';
                statusText.textContent = '저장 실패';
                autoSaveStatus.classList.remove('hidden');
                break;
            case 'inactive':
            default:
                autoSaveStatus.classList.add('hidden');
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
                        parcel.subLots.forEach(subLot => {
                            rows.push({
                                ...log,
                                _isFirstRow: false,
                                _subLotIndex: subLotIndex,
                                _displayNumber: `${log.receptionNumber}-${subLotIndex - 1}`,
                                _lotAddress: subLot,
                                _cropsDisplay: cropsDisplay,
                                _areaDisplay: totalArea > 0 ? totalArea.toLocaleString() : '-'
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

            // 데이터 평탄화
            const flatRows = flattenLogsForTable(logs);
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
                tr.dataset.id = row.id;
                tr.innerHTML = `
                    <td class="col-complete">
                        <button class="btn-complete ${isCompleted ? 'completed' : ''}" data-id="${row.id}" title="${isCompleted ? '완료 취소' : '완료'}">
                            ${isCompleted ? '✓' : '○'}
                        </button>
                    </td>
                    <td>${row._displayNumber}</td>
                    <td>${row.date}</td>
                    <td>${row.name}</td>
                    <td>${row.phoneNumber || '-'}</td>
                    <td title="${row.address || '-'}">${row.address || '-'}</td>
                    <td>${row.sampleType}</td>
                    <td title="${subCategoryDisplay}">${subCategoryDisplay}</td>
                    <td>${row._areaDisplay}</td>
                    <td title="${row._lotAddress}">${row._lotAddress}</td>
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
            { label: '시료종류', value: logData.sampleType },
            { label: '하위 카테고리', value: logData.subCategory || '-' }
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
            '항목': '시료종류',
            '내용': currentRegistrationData.sampleType
        });
        excelData.push({
            '항목': '하위 카테고리',
            '내용': currentRegistrationData.subCategory || '-'
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

                if (parcel.subLots.length > 0) {
                    excelData.push({
                        '항목': '  하위 지번',
                        '내용': parcel.subLots.join(', ')
                    });
                }

                if (parcel.crops.length > 0) {
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
});
