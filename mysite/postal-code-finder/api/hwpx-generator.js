/**
 * HWPX Label Generator - 완전 새로운 구현
 * Korean word processor label format generator
 * 
 * 기능:
 * - 2x9 라벨 형태로 주소 라벨 생성 (A4 용지 기준)
 * - 템플릿 기반 생성으로 높은 호환성
 * - 자동 페이지 분할 및 레이아웃
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

class HwpxGenerator {
  constructor() {
    this.templatePath = path.join(__dirname, '..', 'docs', 'sample_hwpx', '템플릿.hwpx');
    this.validateTemplate();
  }

  /**
   * 템플릿 파일 존재 여부 검증
   */
  validateTemplate() {
    if (!fs.existsSync(this.templatePath)) {
      throw new Error(`HWPX 템플릿 파일을 찾을 수 없습니다: ${this.templatePath}`);
    }
  }

  /**
   * XML 문자열 이스케이프
   */
  escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 주소 라벨 데이터를 HWPX 형식으로 생성
   * @param {Array} items - 라벨 데이터 [{address, detailAddress, name, postalCode}]
   * @param {Object} options - 생성 옵션 {nameSuffix: string}
   * @returns {Buffer} - HWPX 파일 버퍼
   */
  async generate(items, options = {}) {
    try {
      console.log(`HWPX Generator: Creating labels for ${items.length} items`);
      
      // 1. 템플릿 로드
      const templateBuffer = fs.readFileSync(this.templatePath);
      const zip = await JSZip.loadAsync(templateBuffer);
      
      // 2. 라벨 섹션 XML 생성
      const sectionXml = this.buildSectionXml(items, options);
      
      // 3. 섹션 교체
      zip.file('Contents/section0.xml', sectionXml);
      
      // 4. HWPX 파일 생성
      const result = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      console.log(`HWPX Generator: Successfully created ${(result.length / 1024).toFixed(1)}KB file`);
      return result;
      
    } catch (error) {
      console.error('HWPX Generator Error:', error);
      throw new Error(`HWPX 생성 실패: ${error.message}`);
    }
  }

  /**
   * 섹션 XML 생성
   */
  buildSectionXml(items, options = {}) {
    const { nameSuffix = '' } = options;
    const perPage = 18; // 2x9 = 18개씩
    
    // 페이지별로 아이템 분할
    const pages = [];
    for (let i = 0; i < items.length; i += perPage) {
      pages.push(items.slice(i, i + perPage));
    }
    
    // 각 페이지의 테이블 생성
    const pageTables = pages.map((pageItems, pageIndex) => {
      return this.buildPageTable(pageItems, pageIndex, nameSuffix);
    });
    
    // 페이지 구분을 위한 페이지 브레이크
    const pageBreak = `<hp:p pageBreak="1" paraPrIDRef="0" styleIDRef="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>`;
    const allTables = pageTables.join(pageBreak);
    
    // 섹션 XML 반환
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">
  <hp:p id="3121190098" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">
        <hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>
        <hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>
        <hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY">
          <hp:margin header="0" footer="0" gutter="0" left="1134" right="0" top="3685" bottom="0"/>
        </hp:pagePr>
      </hp:secPr>
      <hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>
    </hp:run>
  </hp:p>
  ${allTables}
</hs:sec>`;
  }

  /**
   * 페이지 테이블 생성 (2x9 그리드)
   */
  buildPageTable(pageItems, pageIndex, nameSuffix) {
    let rows = '';
    let cellIndex = 0;
    
    // 9행 생성
    for (let row = 0; row < 9; row++) {
      const leftItem = pageItems[row * 2];
      const rightItem = pageItems[row * 2 + 1];
      
      const leftCell = this.buildCell(leftItem, cellIndex++, nameSuffix);
      const rightCell = this.buildCell(rightItem, cellIndex++, nameSuffix);
      
      rows += `<hp:tr>${leftCell}${rightCell}</hp:tr>`;
    }
    
    return `
  <hp:p paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:ctrl>
        <hp:tbl id="${1959744205 + pageIndex}" zOrder="${pageIndex}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="1" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="9" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">
          <hp:sz width="57544" widthRelTo="ABSOLUTE" height="76536" heightRelTo="ABSOLUTE" protect="1"/>
          <hp:outMargin left="0" right="0" top="0" bottom="0"/>
          <hp:inMargin left="0" right="0" top="0" bottom="0"/>
          ${rows}
          <hp:label topmargin="3685" leftmargin="1134" boxwidth="28347" boxlength="8504" boxmarginhor="850" boxmarginver="0" labelcols="2" labelrows="9" landscape="WIDELY" pagewidth="59528" pageheight="84188"/>
        </hp:tbl>
      </hp:ctrl>
    </hp:run>
  </hp:p>`;
  }

  /**
   * 개별 셀 생성
   */
  buildCell(item, cellId, nameSuffix) {
    // 빈 셀 처리
    if (!item) {
      return `<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="4">
        <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="MIDDLE" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
          <hp:p id="${cellId}_empty" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
            <hp:run charPrIDRef="0"><hp:t/></hp:run>
          </hp:p>
        </hp:subList>
        <hp:cellAddr colAddr="${cellId % 2}" rowAddr="${Math.floor(cellId / 2)}"/>
        <hp:cellSpan colSpan="1" rowSpan="1"/>
        <hp:cellSz width="28772" height="8504"/>
        <hp:cellMargin left="400" right="400" top="200" bottom="200"/>
      </hp:tc>`;
    }

    // 데이터 준비
    const fullAddress = (item.address || '') + (item.detailAddress ? ` ${item.detailAddress}` : '');
    const displayName = (item.name || '') + (nameSuffix ? ` ${nameSuffix}` : '');
    const postalCode = item.postalCode || '';
    
    // 텍스트 라인들
    const texts = [
      fullAddress,    // 주소 (왼쪽 정렬)
      displayName,    // 이름 (오른쪽 정렬)  
      postalCode      // 우편번호 (오른쪽 정렬)
    ];

    // 문단 생성
    const paragraphs = texts.map((text, idx) => {
      const alignment = idx === 0 ? 'LEFT' : 'RIGHT';
      const verticalPos = 1000 + (idx * 1800); // 세로 위치 조정
      
      return `<hp:p id="${cellId}_${idx}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
        <hp:paraPr><hh:align horizontal="${alignment}"/></hp:paraPr>
        <hp:run charPrIDRef="0">
          <hp:t>${this.escapeXml(text)}</hp:t>
        </hp:run>
        <hp:linesegarray>
          <hp:lineseg textpos="0" vertpos="${verticalPos}" vertsize="1200" textheight="1200" baseline="600" spacing="600" horzpos="0" horzsize="28344" flags="393216"/>
        </hp:linesegarray>
      </hp:p>`;
    }).join('');

    return `<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="4">
      <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="MIDDLE" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
        ${paragraphs}
      </hp:subList>
      <hp:cellAddr colAddr="${cellId % 2}" rowAddr="${Math.floor(cellId / 2)}"/>
      <hp:cellSpan colSpan="1" rowSpan="1"/>
      <hp:cellSz width="28772" height="8504"/>
      <hp:cellMargin left="400" right="400" top="200" bottom="200"/>
    </hp:tc>`;
  }
}

module.exports = { HwpxGenerator };