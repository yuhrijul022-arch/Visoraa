import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 32 bytes (64 hex chars)

const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encrypt(text: string): string {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not defined');
    
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(text: string): string {
    if (!ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is not defined');
    
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');

    const parts = text.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted text format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
