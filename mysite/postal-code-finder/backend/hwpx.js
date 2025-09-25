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
  function findOne(keys, excludeIndices = []) {
    for (const k of keys) {
      const idx = lower.findIndex((h, i) => h.includes(k) && !excludeIndices.includes(i));
      if (idx >= 0) return idx;
    }
    return -1;
  }
  
  // 우편번호를 먼저 찾아서 중복을 피함
  const postalCode = findOne(['우편번호', 'zip', 'postal']);
  
  // 주소는 단순 '주소'를 우선하고, '도로명주소'는 후순위
  const address = findOne(['주소'], [postalCode]) >= 0 ? 
    findOne(['주소'], [postalCode]) : findOne(['도로명주소', 'address', 'addr'], [postalCode]);
  
  return {
    address,
    detailAddress: findOne(['상세주소', '상세', 'detail', '세부주소', '추가주소', '아파트', '동호수', '호수', '동', '층', '호'], [address, postalCode]),
    name: findOne(['이름', '성명', 'name'], [address, postalCode]),
    postalCode
  };
}

function buildSectionXml(rows, options = {}) {
  const { nameSuffix = '', perPage = 18, newCharId, paraPrIds } = options;
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }

  function cellXml(texts, cellId, newCharId, paraPrIds) {
    // 라벨 셀 내 문단 배치: linesegarray로 줄 위치를 명시해 조판 안정성 향상
    const CELL_H = 8504; // 한 셀 높이(HWPUNIT)
    const LINE_H = 1200; // 한 줄 높이
    const LINE_SP = 600; // 줄간 간격
    const totalBlock = texts.length > 0 ? (texts.length * LINE_H + (texts.length - 1) * LINE_SP) : 0;
    const startOffset = Math.max(0, Math.round((CELL_H - totalBlock) / 2));

    const paragraphs = texts.map((text, idx) => {
      const content = text || '';
      const pid = `${cellId}_${idx}`;
      // 텍스트별 정렬: 주소(합쳐진)=LEFT / 이름,우편번호=RIGHT
      const inlineAlign = idx === 0 ? 'LEFT' : 'RIGHT';
      // 문단 속성 적용: paraPrIDRef가 있으면 참조, 없으면 인라인 정렬 속성 추가
      let paraAttr = '';
      let paraInline = '';
      if (Array.isArray(paraPrIds) && paraPrIds.length >= 2) {
        const paraPrId = inlineAlign === 'LEFT' ? paraPrIds[0] : paraPrIds[1];
        paraAttr = ` paraPrIDRef="${paraPrId}"`;
      } else {
        // 템플릿 내 기본 스타일을 유지하면서 문단 정렬만 인라인 지정
        paraInline = `<hp:paraPr><hh:align horizontal="${inlineAlign}"/></hp:paraPr>`;
      }
      const vertpos = startOffset + idx * (LINE_H + LINE_SP);
      const runCharAttr = newCharId ? ` charPrIDRef=\"${newCharId}\"` : '';
      return `
        <hp:p id="${pid}"${paraAttr} styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
          ${paraInline}
          <hp:run${runCharAttr}>
            <hp:t>${escapeXml(content)}</hp:t>
          </hp:run>
          <hp:linesegarray>
            <hp:lineseg textpos="0" vertpos="${vertpos}" vertsize="${LINE_H}" textheight="${LINE_H}" baseline="600" spacing="${LINE_SP}" horzpos="0" horzsize="28344" flags="393216"/>
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
        <!-- 셀 여백: 좌우 4pt(400 HWPUNIT), 상하 2pt(200 HWPUNIT) -->
        <hp:cellMargin left="400" right="400" top="200" bottom="200"/>
      </hp:tc>`;
  }

  function pageTable(pageItems, pageIndex = 0) {
    // 2열 9행 테이블
    let trs = '';
    let cellIndex = 0;
    
    for (let r = 0; r < 9; r++) {
      const left = pageItems[r * 2];
      const right = pageItems[r * 2 + 1];
      
      // 실제 데이터로 텍스트 생성 (주소+상세주소, 이름, 우편번호)
      const leftTexts = left ? [
        (left.address || '') + (left.detailAddress ? ` ${left.detailAddress}` : ''),
        (left.name || '') + (nameSuffix ? ` ${nameSuffix}` : ''),
        left.postalCode || ''
      ] : ['', '', ''];
      
      const rightTexts = right ? [
        (right.address || '') + (right.detailAddress ? ` ${right.detailAddress}` : ''),
        (right.name || '') + (nameSuffix ? ` ${nameSuffix}` : ''),
        right.postalCode || ''
      ] : ['', '', ''];
      
      trs += `
        <hp:tr>
          ${cellXml(leftTexts, cellIndex++, newCharId, paraPrIds)}
          ${cellXml(rightTexts, cellIndex++, newCharId, paraPrIds)}
        </hp:tr>`;
    }
    
    return `
      <hp:tbl id="${1959744205 + pageIndex}" zOrder="${pageIndex}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="1" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="9" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">
        <hp:sz width="57544" widthRelTo="ABSOLUTE" height="76536" heightRelTo="ABSOLUTE" protect="1"/>
        <!-- 절대 배치를 제거하고 자연 흐름에 태워 페이지가 자동으로 넘어가도록 함 -->
        <hp:outMargin left="0" right="0" top="0" bottom="0"/>
        <hp:inMargin left="0" right="0" top="0" bottom="0"/>
        ${trs}
        <hp:label topmargin="3685" leftmargin="1134" boxwidth="28347" boxlength="8504" boxmarginhor="850" boxmarginver="0" labelcols="2" labelrows="9" landscape="WIDELY" pagewidth="59528" pageheight="84188"/>
      </hp:tbl>`;
  }

  // 각 페이지 테이블을 흐름에 배치하고, 테이블 사이에는 강제 쪽 나누기 문단을 삽입
  const pageBreakP = `<hp:p pageBreak="1" paraPrIDRef="0" styleIDRef="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run></hp:p>`;
  const allTables = pages
    .map((pageItems, pageIndex) => {
      return `
  <hp:p paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
    <hp:run charPrIDRef="0">
      <hp:ctrl>
        ${pageTable(pageItems, pageIndex)}
      </hp:ctrl>
    </hp:run>
  </hp:p>`;
    })
    .join(pageBreakP);

  // 하나의 섹션에: 섹션 설정 문단 이후, 테이블 문단들을 흐름에 배치 (넓은 네임스페이스 유지)
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

async function buildHwpxFromTemplate(items, options = {}) {
  const tplRoot = path.join(__dirname, '..', 'docs', 'sample_hwpx');
  // Load template files
  let headerXml = fs.readFileSync(path.join(tplRoot, 'Contents', 'header.xml'), 'utf8');
  let contentHpf = fs.readFileSync(path.join(tplRoot, 'Contents', 'content.hpf'), 'utf8');
  let manifestXml = fs.readFileSync(path.join(tplRoot, 'META-INF', 'manifest.xml'), 'utf8');
  
  // 동적 ID 할당: 기존 최대 ID 스캔
  const maxCharId = Math.max(...[...headerXml.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => +m[1] || 0));
  const maxParaId = Math.max(...[...headerXml.matchAll(/<hh:paraPr id="(\d+)"/g)].map(m => +m[1] || 0));
  
  const newCharId = maxCharId + 1;
  const newParaIdLeft = maxParaId + 1;
  const newParaIdRight = maxParaId + 2;
  const newParaIdCenter = maxParaId + 3;
  
  console.log(`Dynamic ID allocation: charId=${newCharId}, paraIds=[${newParaIdLeft}, ${newParaIdRight}, ${newParaIdCenter}]`);
  
  // 11pt 폰트 문자 속성 (적절한 크기로 조정)
  const newCharPr11pt = `<hh:charPr id="${newCharId}" height="1100" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2"><hh:fontRef hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>`;
  
  // 줄 간격을 130%로 설정하여 적절한 간격 유지
  const newParaPrLeft = `<hh:paraPr id="${newParaIdLeft}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="0" suppressLineNumbers="0" checked="0"><hh:align horizontal="LEFT" vertical="TOP"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace=\"http://www.hancom.co.kr/hwpml/2016/HwpUnitChar\"><hh:margin><hc:intent value=\"0\" unit=\"HWPUNIT\"/><hc:left value=\"0\" unit=\"HWPUNIT\"/><hc:right value=\"0\" unit=\"HWPUNIT\"/><hc:prev value=\"0\" unit=\"HWPUNIT\"/><hc:next value=\"120\" unit=\"HWPUNIT\"/></hh:margin><hh:lineSpacing type=\"PERCENT\" value=\"130\" unit=\"HWPUNIT\"/></hp:case><hp:default><hh:margin><hc:intent value=\"0\" unit=\"HWPUNIT\"/><hc:left value=\"0\" unit=\"HWPUNIT\"/><hc:right value=\"0\" unit=\"HWPUNIT\"/><hc:prev value=\"0\" unit=\"HWPUNIT\"/><hc:next value=\"120\" unit=\"HWPUNIT\"/></hh:margin><hh:lineSpacing type=\"PERCENT\" value=\"130\" unit=\"HWPUNIT\"/></hp:default></hp:switch><hh:border borderFillIDRef=\"2\" offsetLeft=\"0\" offsetRight=\"0\" offsetTop=\"0\" offsetBottom=\"0\" connect=\"0\" ignoreMargin=\"0\"/></hh:paraPr>`;
  
  const newParaPrRight = `<hh:paraPr id="${newParaIdRight}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="0" suppressLineNumbers="0" checked="0"><hh:align horizontal="RIGHT" vertical="TOP"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace=\"http://www.hancom.co.kr/hwpml/2016/HwpUnitChar\"><hh:margin><hc:intent value=\"0\" unit=\"HWPUNIT\"/><hc:left value=\"0\" unit=\"HWPUNIT\"/><hc:right value=\"0\" unit=\"HWPUNIT\"/><hc:prev value=\"0\" unit=\"HWPUNIT\"/><hc:next value=\"120\" unit=\"HWPUNIT\"/></hh:margin><hh:lineSpacing type=\"PERCENT\" value=\"130\" unit=\"HWPUNIT\"/></hp:case><hp:default><hh:margin><hc:intent value=\"0\" unit=\"HWPUNIT\"/><hc:left value=\"0\" unit=\"HWPUNIT\"/><hc:right value=\"0\" unit=\"HWPUNIT\"/><hc:prev value=\"0\" unit=\"HWPUNIT\"/><hc:next value=\"120\" unit=\"HWPUNIT\"/></hh:margin><hh:lineSpacing type=\"PERCENT\" value=\"130\" unit=\"HWPUNIT\"/></hp:default></hp:switch><hh:border borderFillIDRef=\"2\" offsetLeft=\"0\" offsetRight=\"0\" offsetTop=\"0\" offsetBottom=\"0\" connect=\"0\" ignoreMargin=\"0\"/></hh:paraPr>`;
  
  const newParaPrCenter = `<hh:paraPr id="${newParaIdCenter}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="0" suppressLineNumbers="0" checked="0"><hh:align horizontal="CENTER" vertical="CENTER"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="100" unit="HWPUNIT"/></hp:case><hp:default><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="0" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="100" unit="HWPUNIT"/></hp:default></hp:switch><hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
  
  // 안전한 itemCnt 업데이트 (정확한 요소 타겟팅)
  headerXml = headerXml.replace(
    /(<hh:charProperties[^>]*itemCnt=")(\d+)(")/,
    (_, a, n, c) => `${a}${Number(n) + 1}${c}`
  );
  headerXml = headerXml.replace(
    /(<hh:paraProperties[^>]*itemCnt=")(\d+)(")/,
    (_, a, n, c) => `${a}${Number(n) + 3}${c}`
  );
  
  // Insert new properties before closing tags
  headerXml = headerXml.replace('</hh:charProperties>', newCharPr11pt + '</hh:charProperties>');
  headerXml = headerXml.replace('</hh:paraProperties>', newParaPrLeft + newParaPrRight + newParaPrCenter + '</hh:paraProperties>');

  // Ensure Contents/content.hpf references section0.xml (opf manifest + spine)
  if (!/href=\"Contents\/section0\.xml\"/i.test(contentHpf)) {
    // add item in opf:manifest
    contentHpf = contentHpf.replace(/<opf:manifest>([\s\S]*?)<\/opf:manifest>/, (m, inner) => {
      if (/href=\"Contents\/section0\.xml\"/i.test(inner)) return m;
      return `<opf:manifest>${inner}<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/></opf:manifest>`;
    });
    // add itemref in spine
    contentHpf = contentHpf.replace(/<opf:spine>([\s\S]*?)<\/opf:spine>/, (m, inner) => {
      if (/idref=\"section0\"/i.test(inner)) return m;
      return `<opf:spine>${inner}<opf:itemref idref="section0" linear="yes"/></opf:spine>`;
    });
  }

  // Ensure META-INF/manifest.xml lists section0.xml
  if (!/section0\.xml/i.test(manifestXml)) {
    if (/<odf:manifest[^>]*\/>/.test(manifestXml)) {
      // expand self-closing root
      manifestXml = manifestXml.replace(/<odf:manifest([^>]*)\/>/, (m, attrs) => `<odf:manifest${attrs}>
  <odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>
</odf:manifest>`);
    } else {
      manifestXml = manifestXml.replace(/<\/odf:manifest>/, `  <odf:file-entry odf:full-path="Contents/section0.xml" odf:media-type="application/xml"/>
</odf:manifest>`);
    }
  }

  const files = {
    'mimetype': fs.readFileSync(path.join(tplRoot, 'mimetype')),
    'version.xml': fs.readFileSync(path.join(tplRoot, 'version.xml')),
    'settings.xml': fs.readFileSync(path.join(tplRoot, 'settings.xml')),
    'Contents/header.xml': Buffer.from(headerXml, 'utf8'),
    'Contents/content.hpf': Buffer.from(contentHpf, 'utf8'),
    'META-INF/container.rdf': fs.readFileSync(path.join(tplRoot, 'META-INF', 'container.rdf')),
    'META-INF/container.xml': fs.readFileSync(path.join(tplRoot, 'META-INF', 'container.xml')),
    'META-INF/manifest.xml': Buffer.from(manifestXml, 'utf8'),
  };

  // Section content - 동적 ID들을 전달
  const paraPrIds = [newParaIdLeft, newParaIdRight, newParaIdRight]; // 주소(왼쪽), 이름(오른쪽), 우편번호(오른쪽)
  const sectionXml = buildSectionXml(items, { 
    ...options, 
    newCharId, 
    paraPrIds 
  });

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

async function buildHwpxFromHwpxTemplate(templateHwpxPath, items, options = {}) {
  const absPath = path.isAbsolute(templateHwpxPath)
    ? templateHwpxPath
    : path.join(__dirname, '..', templateHwpxPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`템플릿 파일을 찾을 수 없습니다: ${absPath}`);
  }

  // 템플릿 .hwpx 로드
  const raw = fs.readFileSync(absPath);
  const zip = await JSZip.loadAsync(raw);

  // 새 섹션 XML 생성 (템플릿 스타일/마진은 템플릿에 포함되었다고 가정)
  const sectionXml = buildSectionXml(items, options);

  // 기존 섹션 교체
  zip.file('Contents/section0.xml', sectionXml);

  // 결과 버퍼 생성
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}

module.exports = { buildHwpxFromTemplate, buildHwpxFromHwpxTemplate, detectColumns };
