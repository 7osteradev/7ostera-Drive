'use strict';
const crypto = require('crypto');

const RAW_KEY = process.env.ENCRYPTION_KEY || '';
if (!RAW_KEY || RAW_KEY.length < 32) {
  console.warn(
    '\n  ⚠️  ENCRYPTION_KEY not set or too short! ' +
    'Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n'
  );
}

const MASTER_KEY = crypto.createHash('sha256').update(RAW_KEY || 'INSECURE_DEFAULT_KEY').digest();
const FIELD_KEY  = crypto.createHash('sha256').update('field:' + (RAW_KEY || 'INSECURE_DEFAULT_KEY')).digest();

const FILE_ALG  = 'aes-256-gcm';
const FIELD_ALG = 'aes-256-cbc';
const IV_LEN    = 16;
const TAG_LEN   = 16;
const VERSION   = 0x01;

function encryptFileStream(readStream, writeStream) {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(FILE_ALG, MASTER_KEY, iv);

    writeStream.write(Buffer.from([VERSION]));
    writeStream.write(iv);

    readStream.pipe(cipher).pipe(writeStream, { end: false });

    cipher.on('end', () => {
      writeStream.write(cipher.getAuthTag());
      writeStream.end();
    });
    cipher.on('error', reject);
    readStream.on('error', reject);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}

function decryptFileStream(encryptedPath, outputStream, totalEncryptedSize) {
  return new Promise((resolve, reject) => {
    const headerSize = 1 + IV_LEN;
    const headerBuf  = Buffer.allocUnsafe(headerSize + TAG_LEN);

    const fd = require('fs').openSync(encryptedPath, 'r');
    require('fs').readSync(fd, headerBuf, 0, headerSize + TAG_LEN, 0);

    const tagBuf = Buffer.allocUnsafe(TAG_LEN);
    require('fs').readSync(fd, tagBuf, 0, TAG_LEN, totalEncryptedSize - TAG_LEN);
    require('fs').closeSync(fd);

    const iv  = headerBuf.slice(1, 1 + IV_LEN);
    const decipher = crypto.createDecipheriv(FILE_ALG, MASTER_KEY, iv);
    decipher.setAuthTag(tagBuf);

    const bodyStart = headerSize;
    const bodyEnd   = totalEncryptedSize - TAG_LEN - 1;

    const fs = require('fs');
    const readStream = fs.createReadStream(encryptedPath, { start: bodyStart, end: bodyEnd });
    readStream.pipe(decipher).pipe(outputStream, { end: false });

    decipher.on('end', () => { outputStream.end(); resolve(); });
    decipher.on('error', reject);
    readStream.on('error', reject);
    outputStream.on('error', reject);
  });
}

function decryptFileToBuffer(encryptedPath) {
  const fs    = require('fs');
  const data  = fs.readFileSync(encryptedPath);
  const iv    = data.slice(1, 1 + IV_LEN);
  const tag   = data.slice(data.length - TAG_LEN);
  const body  = data.slice(1 + IV_LEN, data.length - TAG_LEN);

  const decipher = crypto.createDecipheriv(FILE_ALG, MASTER_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

function getDecryptedSize(encryptedSize) {
  return Math.max(0, encryptedSize - 1 - IV_LEN - TAG_LEN);
}

const FIELD_PREFIX = 'enc:';

function encryptField(value) {
  if (!value) return value;
  const iv     = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(FIELD_ALG, FIELD_KEY, iv);
  const enc    = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return FIELD_PREFIX + iv.toString('hex') + ':' + enc.toString('hex');
}

function decryptField(value) {
  if (!value || !String(value).startsWith(FIELD_PREFIX)) return value;
  try {
    const rest     = String(value).slice(FIELD_PREFIX.length);
    const colonIdx = rest.indexOf(':');
    const iv       = Buffer.from(rest.slice(0, colonIdx), 'hex');
    const enc      = Buffer.from(rest.slice(colonIdx + 1), 'hex');
    const decipher = crypto.createDecipheriv(FIELD_ALG, FIELD_KEY, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return value;
  }
}

function decryptUser(user) {
  if (!user) return user;
  return { ...user, name: decryptField(user.name), email: decryptField(user.email) };
}

function decryptFile(file) {
  if (!file) return file;
  return { ...file, name: decryptField(file.name) };
}

function decryptFiles(files) {
  return files.map(decryptFile);
}

function hmacSign(data) {
  return crypto.createHmac('sha256', MASTER_KEY).update(String(data)).digest('hex');
}

function hmacVerify(data, sig) {
  const expected = hmacSign(data);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
}

module.exports = {
  MASTER_KEY,
  encryptFileStream,
  decryptFileStream,
  decryptFileToBuffer,
  getDecryptedSize,
  encryptField,
  decryptField,
  decryptUser,
  decryptFile,
  decryptFiles,
  hmacSign,
  hmacVerify,
  OVERHEAD: 1 + IV_LEN + TAG_LEN,
};
