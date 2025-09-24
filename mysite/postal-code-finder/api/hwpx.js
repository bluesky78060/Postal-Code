const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

function escapeXml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function detectColumns(headers) {
  const lower = headers.map(h => String(h || '').toLowerCase());
  function findOne(keys) {
    for (const k of keys) {
      const idx = lower.findIndex(h => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  }
  return {
    address: findOne(['주소', 'address', 'addr', 'road', '도로']),
    name: findOne(['이름', '성명', 'name']),
    postalCode: findOne(['우편번호', 'zip', 'postal'])
  };
}

function buildSectionXml(rows, options = {}) {
  const { nameSuffix = '', perPage = 18 } = options;
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }

  function cellXml(texts, cellId) {
    // 실제 텍스트 내용을 포함한 3줄 생성 (주소: 왼쪽정렬, 이름: 오른쪽정렬, 우편번호: 오른쪽정렬)
    const alignments = ['LEFT', 'RIGHT', 'RIGHT']; // 주소, 이름, 우편번호 순서
    const paraPrIds = [11, 11, 11]; // 모두 동일한 paragraph property 사용
    
    const paragraphs = texts.map((text, idx) => {
      const content = text || '';
      const pid = `${cellId}_${idx}`;
      const alignment = alignments[idx] || 'LEFT';
      const paraPrId = paraPrIds[idx];
      
      // 정렬에 따른 수평 위치 계산
      let horzpos = 0; // 기본값 (왼쪽 정렬)
      if (alignment === 'RIGHT') {
        horzpos = 20000; // 오른쪽 정렬을 위해 텍스트를 오른쪽으로 이동
      }
      
      return `
        <hp:p id="${pid}" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          <hp:paraPr align="${alignment}"/>
          <hp:run charPrIDRef="0">
            <hp:t>${escapeXml(content)}</hp:t>
          </hp:run>
          <hp:linesegarray>
            <hp:lineseg textpos="0" vertpos="${idx * 1000}" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="${horzpos}" horzsize="28344" flags="393216"/>
          </hp:linesegarray>
        </hp:p>`;
    }).join('');
    
    return `
      <hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="4">
        <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="MIDDLE" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
          ${paragraphs}
        </hp:subList>
        <hp:cellAddr colAddr="${cellId % 2}" rowAddr="${Math.floor(cellId / 2)}"/>
        <hp:cellSpan colSpan="1" rowSpan="1"/>
        <hp:cellSz width="28772" height="8504"/>
        <hp:cellMargin left="${cellId % 2 === 0 ? '0' : '425'}" right="${cellId % 2 === 0 ? '425' : '0'}" top="0" bottom="0"/>
      </hp:tc>`;
  }

  function pageTable(pageItems) {
    // 2열 9행 테이블
    let trs = '';
    let cellIndex = 0;
    
    for (let r = 0; r < 9; r++) {
      const left = pageItems[r * 2];
      const right = pageItems[r * 2 + 1];
      
      // 실제 데이터로 텍스트 생성
      const leftTexts = left ? [
        left.address || '', 
        (left.name || '') + (nameSuffix ? ` ${nameSuffix}` : ''), 
        left.postalCode || ''
      ] : ['', '', ''];
      
      const rightTexts = right ? [
        right.address || '', 
        (right.name || '') + (nameSuffix ? ` ${nameSuffix}` : ''), 
        right.postalCode || ''
      ] : ['', '', ''];
      
      trs += `
        <hp:tr>
          ${cellXml(leftTexts, cellIndex++)}
          ${cellXml(rightTexts, cellIndex++)}
        </hp:tr>`;
    }
    
    return `
      <hp:tbl id="1959744205" zOrder="0" numberingType="TABLE" textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="1" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="9" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">
        <hp:sz width="57544" widthRelTo="ABSOLUTE" height="76536" heightRelTo="ABSOLUTE" protect="1"/>
        <hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PAGE" horzRelTo="PAGE" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
        <hp:outMargin left="0" right="0" top="0" bottom="0"/>
        <hp:inMargin left="0" right="0" top="0" bottom="0"/>
        ${trs}
        <hp:label topmargin="3685" leftmargin="1134" boxwidth="28347" boxlength="8504" boxmarginhor="850" boxmarginver="0" labelcols="2" labelrows="9" landscape="WIDELY" pagewidth="59528" pageheight="84188"/>
      </hp:tbl>`;
  }

  const mainTable = pages.length > 0 ? pageTable(pages[0]) : pageTable([]);

  // 샘플과 동일한 구조로 생성 (섹션 속성과 테이블 포함)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><hp:p id="3121190098" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="0" footer="0" gutter="0" left="1134" right="0" top="3685" bottom="0"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run><hp:run charPrIDRef="0">${mainTable}<hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="58392" flags="393216"/></hp:linesegarray></hp:p></hs:sec>`;
}

async function buildHwpxFromTemplate(items, options = {}) {
  const tplRoot = path.join(__dirname, '..', 'docs', 'sample_hwpx');
  // Load template files
  const files = {
    'mimetype': fs.readFileSync(path.join(tplRoot, 'mimetype')),
    'version.xml': fs.readFileSync(path.join(tplRoot, 'version.xml')),
    'settings.xml': fs.readFileSync(path.join(tplRoot, 'settings.xml')),
    'Contents/header.xml': fs.readFileSync(path.join(tplRoot, 'Contents', 'header.xml')),
    'Contents/content.hpf': fs.readFileSync(path.join(tplRoot, 'Contents', 'content.hpf')),
    'META-INF/container.rdf': fs.readFileSync(path.join(tplRoot, 'META-INF', 'container.rdf')),
    'META-INF/container.xml': fs.readFileSync(path.join(tplRoot, 'META-INF', 'container.xml')),
    'META-INF/manifest.xml': fs.readFileSync(path.join(tplRoot, 'META-INF', 'manifest.xml')),
  };

  // Section content
  const sectionXml = buildSectionXml(items, options);

  const zip = new JSZip();
  // Important: store mimetype without compression (common OPC pattern)
  zip.file('mimetype', files['mimetype'], { compression: 'STORE' });
  zip.file('version.xml', files['version.xml']);
  zip.file('settings.xml', files['settings.xml']);
  zip.file('Contents/header.xml', files['Contents/header.xml']);
  zip.file('Contents/content.hpf', files['Contents/content.hpf']);
  zip.file('Contents/section0.xml', sectionXml);
  zip.file('META-INF/container.rdf', files['META-INF/container.rdf']);
  zip.file('META-INF/container.xml', files['META-INF/container.xml']);
  zip.file('META-INF/manifest.xml', files['META-INF/manifest.xml']);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}

module.exports = { buildHwpxFromTemplate, detectColumns };
