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

  function cellXml(texts) {
    // 3줄(주소, 이름, 우편번호)을 단순 문단으로 생성
    const paragraphs = texts.map(t => `
      <hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
        <hp:run charPrIDRef="0">
          <hp:t>${escapeXml(t)}</hp:t>
        </hp:run>
      </hp:p>`).join('');
    return `
      <hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="4">
        <hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">
          ${paragraphs}
        </hp:subList>
        <hp:cellSpan colSpan="1" rowSpan="1"/>
      </hp:tc>`;
  }

  function pageTable(pageItems) {
    // 2열 9행 테이블
    let trs = '';
    for (let r = 0; r < 9; r++) {
      const left = pageItems[r * 2];
      const right = pageItems[r * 2 + 1];
      const leftTexts = left ? [left.address, left.name + (nameSuffix ? ` ${nameSuffix}` : ''), left.postalCode] : ['','',''];
      const rightTexts = right ? [right.address, right.name + (nameSuffix ? ` ${nameSuffix}` : ''), right.postalCode] : ['','',''];
      trs += `
        <hp:tr>
          ${cellXml(leftTexts)}
          ${cellXml(rightTexts)}
        </hp:tr>`;
    }
    return `
      <hp:tbl id="1" zOrder="0" numberingType="TABLE" textWrap="IN_FRONT_OF_TEXT" textFlow="BOTH_SIDES" lock="1" pageBreak="CELL" repeatHeader="1" rowCnt="9" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">
        <hp:sz width="57544" widthRelTo="ABSOLUTE" height="76536" heightRelTo="ABSOLUTE" protect="1"/>
        <hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PAGE" horzRelTo="PAGE" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>
        <hp:outMargin left="0" right="0" top="0" bottom="0"/>
        <hp:inMargin left="0" right="0" top="0" bottom="0"/>
        ${trs}
      </hp:tbl>`;
  }

  const pageXml = pages.map((items, idx) => `
    <hp:p id="p${idx}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">
      <hp:run charPrIDRef="0">
        ${pageTable(items)}
      </hp:run>
    </hp:p>`).join('');

  // 섹션 XML 래퍼 (필요한 네임스페이스는 샘플과 동일하게 유지)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">
  ${pageXml}
</hs:sec>`;
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

