import OSS from "ali-oss";
import Sts20150401, * as $Sts20150401 from '@alicloud/sts20150401';
import * as $OpenApi from '@alicloud/openapi-client';
import { readFileSync } from 'fs';
import { join } from 'path';

// STS 临时凭证接口
interface STSCredentials {
    accessKeyId: string;
    accessKeySecret: string;
    securityToken: string;
    expiration: string;
}

// 上传模式枚举
export enum UploadMode {
    OSS = 'OSS',
    HOOK = 'HOOK'
}

// 获取项目版本号
const getProjectVersion = (): string => {
    try {
        const packageJsonPath = join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version || '1.6.0';
    } catch {
        return '1.6.0'; // 默认版本
    }
};

// 上传结果接口
export interface UploadResult {
    success: boolean;
    data?: {
        cdnUrl: string;
        fileName: string;
        originalUrl: string;
        etag?: string;
    };
    error?: string;
    message: string;
}

// 获取STS临时凭证的内部函数
const getSTSCredentials = async (): Promise<STSCredentials> => {
    // 验证STS配置环境变量
    const accessKeyId = process.env.STS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.STS_ACCESS_KEY_SECRET;
    const roleArn = process.env.STS_ROLE_ARN;
    let endpoint = process.env.STS_ENDPOINT || 'sts.cn-hangzhou.aliyuncs.com';

    if (!accessKeyId || !accessKeySecret || !roleArn) {
        throw new Error('STS configuration is incomplete. Please check STS_ACCESS_KEY_ID, STS_ACCESS_KEY_SECRET, and STS_ROLE_ARN environment variables.');
    }

    // 确保endpoint不包含协议前缀（SDK会自动添加）
    if (endpoint.startsWith('https://') || endpoint.startsWith('http://')) {
        endpoint = endpoint.replace(/^https?:\/\//, '');
    }

    // 创建STS客户端配置
    const config = new $OpenApi.Config({
        accessKeyId,
        accessKeySecret,
        endpoint,
    });

    // 创建STS客户端
    const stsClient = new Sts20150401(config);

    // 构建AssumeRole请求
    const assumeRoleRequest = new $Sts20150401.AssumeRoleRequest({
        roleArn,
        roleSessionName: `oss-upload-session-${Date.now()}`,
        durationSeconds: 3600, // 1小时
        // 添加策略进一步限制权限
        policy: JSON.stringify({
            Version: "1",
            Statement: [
                {
                    Effect: "Allow",
                    Action: [
                        "oss:PutObject",
                        "oss:GetObject"
                    ],
                    Resource: [
                        `acs:oss:*:*:${process.env.OSS_BUCKET}/*`
                    ]
                }
            ]
        })
    });

    // 获取临时凭证
    const response = await stsClient.assumeRole(assumeRoleRequest);
    const credentials = response.body?.credentials;

    if (!credentials) {
        throw new Error('Failed to get STS credentials');
    }

    return {
        accessKeyId: credentials.accessKeyId!,
        accessKeySecret: credentials.accessKeySecret!,
        securityToken: credentials.securityToken!,
        expiration: credentials.expiration!
    };
};

// 验证并处理文件名
const processFileName = (originalUrl: string, contentType?: string): string => {
    let fileName = originalUrl.split('/').pop() || `image_${Date.now()}.jpg`;
    
    // 移除查询参数（如 ?wx_fmt=jpeg）
    if (fileName.includes('?')) {
        fileName = fileName.split('?')[0];
    }
    
    // 如果文件名为空或者只是数字，生成有意义的文件名
    if (!fileName || fileName.match(/^\d+$/) || fileName === '') {
        const extension = contentType?.includes('png') ? 'png' : 
                         contentType?.includes('gif') ? 'gif' :
                         contentType?.includes('webp') ? 'webp' : 'jpg';
        fileName = `image_${Date.now()}.${extension}`;
    }
    
    // 确保文件名有扩展名
    if (!fileName.includes('.')) {
        const extension = contentType?.includes('png') ? 'png' : 
                         contentType?.includes('gif') ? 'gif' :
                         contentType?.includes('webp') ? 'webp' : 'jpg';
        fileName = `${fileName}.${extension}`;
    }
    
    // 清理文件名，移除不安全字符
    fileName = fileName.replace(/[^a-zA-Z0-9\-_.]/g, '_');
    
    return fileName;
};

// 验证图片URL格式
const validateImageUrl = (imageURL: string): void => {
    try {
        const url = new URL(imageURL);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Only HTTP and HTTPS URLs are supported');
        }
    } catch {
        throw new Error('Invalid URL format');
    }
};

// 验证OSS配置
const validateOSSConfig = (): { endpoint: string; bucket: string; cdnEndpoint: string } => {
    const endpoint = process.env.OSS_ENDPOINT;
    const bucket = process.env.OSS_BUCKET;
    const cdnEndpoint = process.env.CDN_ENDPOINT;

    if (!endpoint || !bucket || !cdnEndpoint) {
        throw new Error('OSS configuration is incomplete. Please check OSS_ENDPOINT, OSS_BUCKET, and CDN_ENDPOINT environment variables.');
    }

    return { endpoint, bucket, cdnEndpoint };
};

// HOOK模式上传函数
const uploadImageViaHook = async (imageURL: string): Promise<UploadResult> => {
    try {
        const hookUrl = process.env.UPLOAD_HOOK_URL;
        if (!hookUrl) {
            throw new Error('UPLOAD_HOOK_URL is required for HOOK mode');
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`Uploading via HOOK to: ${hookUrl}`);
        }

        const version = getProjectVersion();
        const response = await fetch(hookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `AliOSS-MCP-Server/${version}`
            },
            body: JSON.stringify({ imageURL }),
            signal: AbortSignal.timeout(60000) // 1分钟超时
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HOOK request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json() as {
            code?: number;
            success?: boolean;
            message?: string;
            data?: {
                url?: string;
                cdnUrl?: string;
                name?: string;
                fileName?: string;
            };
        };
        
        // 处理不同的响应格式
        if (result.code !== undefined) {
            // 格式1: { code: 200, data: { url, name }, message }
            if (result.code !== 200) {
                throw new Error(result.message || 'HOOK request failed');
            }
            if (!result.data) {
                throw new Error('No data returned from HOOK');
            }
            return {
                success: true,
                data: {
                    cdnUrl: result.data.url || result.data.cdnUrl || '',
                    fileName: result.data.name || result.data.fileName || '',
                    originalUrl: imageURL
                },
                message: 'Image successfully transferred via HOOK'
            };
        } else if (result.success !== undefined) {
            // 格式2: { success: true, data: { cdnUrl, fileName }, message }
            if (!result.success) {
                throw new Error(result.message || 'HOOK request failed');
            }
            if (!result.data) {
                throw new Error('No data returned from HOOK');
            }
            return {
                success: true,
                data: {
                    cdnUrl: result.data.cdnUrl || result.data.url || '',
                    fileName: result.data.fileName || result.data.name || '',
                    originalUrl: imageURL
                },
                message: result.message || 'Image successfully transferred via HOOK'
            };
        } else {
            throw new Error('Invalid response format from HOOK');
        }

    } catch (error) {
        console.error('Error uploading image via HOOK:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return {
            success: false,
            error: errorMessage,
            message: 'Failed to transfer image via HOOK'
        };
    }
};

// OSS模式上传函数
const uploadImageViaOSS = async (imageURL: string): Promise<UploadResult> => {
    try {
        // 1. 验证输入
        if (!imageURL) {
            throw new Error('imageURL is required');
        }

        validateImageUrl(imageURL);
        const { endpoint, bucket, cdnEndpoint } = validateOSSConfig();

        // 2. 获取STS临时凭证
        const credentials = await getSTSCredentials();

        // 3. 创建OSS客户端
        const oss = new OSS({
            accessKeyId: credentials.accessKeyId,
            accessKeySecret: credentials.accessKeySecret,
            stsToken: credentials.securityToken,
            endpoint,
            bucket,
            timeout: 60000, // 60秒超时
        });

        // 4. 下载图片
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Downloading image from: ${imageURL}`);
        }
        const version = getProjectVersion();
        const response = await fetch(imageURL, {
            signal: AbortSignal.timeout(30000), // 30秒超时
            headers: {
                'User-Agent': `AliOSS-MCP-Server/${version}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        // 5. 验证内容类型
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}. Only images are supported.`);
        }

        // 6. 检查文件大小（最大50MB）
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            throw new Error('File size too large. Maximum 50MB allowed.');
        }

        // 7. 获取图片数据
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // 8. 处理文件名和路径
        const fileName = processFileName(imageURL, contentType);
        const key = `images/${fileName}`;

        // 9. 上传到OSS
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Uploading to OSS: ${key}`);
        }
        const uploadResult = await oss.put(key, buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000', // 1年缓存
            },
        });

        // 10. 构建返回结果
        const cdnUrl = `${cdnEndpoint}/${uploadResult.name}`;
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`Upload successful: ${cdnUrl}`);
        }
        
        return {
            success: true,
            data: {
                cdnUrl,
                fileName: uploadResult.name,
                originalUrl: imageURL,
                etag: (uploadResult.res as any)?.headers?.etag
            },
            message: 'Image successfully transferred to OSS'
        };

    } catch (error) {
        console.error('Error uploading image to OSS:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        return {
            success: false,
            error: errorMessage,
            message: 'Failed to transfer image to OSS'
        };
    }
};

// 主要的上传函数 - 根据模式选择上传方式
export const uploadImageToOSS = async (imageURL: string): Promise<UploadResult> => {
    const mode = (process.env.UPLOAD_MODE || 'OSS').toUpperCase() as UploadMode;
    
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Upload mode: ${mode}`);
    }
    
    // 验证输入
    if (!imageURL) {
        return {
            success: false,
            error: 'imageURL is required',
            message: 'Invalid input parameters'
        };
    }

    validateImageUrl(imageURL);

    switch (mode) {
        case UploadMode.HOOK:
            return await uploadImageViaHook(imageURL);
        case UploadMode.OSS:
            return await uploadImageViaOSS(imageURL);
        default:
            return {
                success: false,
                error: `Unsupported upload mode: ${mode}`,
                message: 'Invalid upload mode configuration'
            };
    }
};

// 导出配置验证函数，用于健康检查
export const checkConfiguration = (): { valid: boolean; missing: string[]; mode: string } => {
    const mode = (process.env.UPLOAD_MODE || 'OSS').toUpperCase();
    
    let required: string[] = [];
    
    if (mode === 'HOOK') {
        required = ['UPLOAD_HOOK_URL'];
    } else if (mode === 'OSS') {
        required = [
            'STS_ACCESS_KEY_ID',
            'STS_ACCESS_KEY_SECRET', 
            'STS_ROLE_ARN',
            'OSS_ENDPOINT',
            'OSS_BUCKET',
            'CDN_ENDPOINT'
        ];
    }
    
    const missing = required.filter(key => !process.env[key]);
    
    return {
        valid: missing.length === 0,
        missing,
        mode
    };
};