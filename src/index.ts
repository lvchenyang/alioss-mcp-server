#!/usr/bin/env node

import express from 'express';
import { config } from 'dotenv';
import { uploadImageToOSS, checkConfiguration } from './upload-to-alioss.js';

// 加载环境变量
config();

// MCP协议类型定义
interface McpRequest {
    jsonrpc: '2.0';
    id: string | number | null;
    method: string;
    params?: any;
}

interface McpResponse {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}

// 上传图片到OSS（直接使用阿里云SDK，不再代理API）
async function handleImageUpload(imageURL: string) {
    const result = await uploadImageToOSS(imageURL);
    
    if (!result.success) {
        throw new Error(result.error || 'Upload failed');
    }
    
    return {
        url: result.data!.cdnUrl,
        name: result.data!.fileName,
        originalUrl: result.data!.originalUrl,
        etag: result.data!.etag
    };
}

// Express应用
const app = express();
app.use(express.json());

// CORS中间件
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

// MCP服务器状态
let serverInitialized = false;
const serverInfo = {
    name: 'alioss-mcp-server',
    version: '1.6.0'
};

const serverCapabilities = {
    tools: {
        listChanged: true
    }
};

const availableTools = [{
    name: 'transfer_image_to_oss',
    description: 'Transfer an image from a given URL to Alibaba Cloud OSS and return structured data with CDN URL, file name, and original URL',
    inputSchema: {
        type: 'object',
        properties: {
            imageURL: {
                type: 'string',
                format: 'uri',
                description: 'The URL of the image to transfer to OSS'
            }
        },
        required: ['imageURL']
    },
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the transfer was successful'
            },
            data: {
                type: 'object',
                properties: {
                    cdnUrl: {
                        type: 'string',
                        description: 'The CDN URL of the transferred image'
                    },
                    fileName: {
                        type: 'string',
                        description: 'The file name in OSS storage'
                    },
                    originalUrl: {
                        type: 'string',
                        description: 'The original image URL'
                    }
                },
                nullable: true
            },
            message: {
                type: 'string',
                description: 'Success or error message'
            },
            error: {
                type: 'string',
                description: 'Error details if transfer failed'
            }
        },
        required: ['success', 'message']
    }
}];

// 处理MCP请求的主要函数
async function handleMcpRequest(request: McpRequest): Promise<McpResponse> {
    const { method, id, params } = request;

    try {
        switch (method) {
            case 'initialize': {
                serverInitialized = true;
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: serverCapabilities,
                        serverInfo
                    }
                };
            }

            case 'notifications/initialized': {
                // 客户端确认初始化完成
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {}
                };
            }

            case 'tools/list': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: availableTools
                    }
                };
            }

            case 'tools/call': {
                if (!serverInitialized) {
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32002,
                            message: 'Server not initialized'
                        }
                    };
                }

                const { name, arguments: args } = params;

                if (name === 'transfer_image_to_oss') {
                    try {
                        const result = await handleImageUpload(args.imageURL);
                        const structuredData = {
                            success: true,
                            data: {
                                cdnUrl: result.url,         // 主要结果：CDN地址
                                fileName: result.name,      // 文件名
                                originalUrl: result.originalUrl, // 原始URL
                                etag: result.etag           // 文件ETag
                            },
                            message: 'Image successfully transferred to OSS'
                        };
                        
                        return {
                            jsonrpc: '2.0',
                            id,
                            result: {
                                // MCP规范：结构化内容
                                structuredContent: structuredData,
                                // MCP规范：为了向后兼容，SHOULD提供序列化的JSON在TextContent中
                                content: [{
                                    type: 'text',
                                    text: JSON.stringify(structuredData)
                                }]
                            }
                        };
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        const errorData = {
                            success: false,
                            data: null,
                            error: errorMessage,
                            message: 'Failed to transfer image to OSS'
                        };
                        
                        return {
                            jsonrpc: '2.0',
                            id,
                            result: {
                                // MCP规范：错误处理设置isError
                                isError: true,
                                // MCP规范：结构化内容
                                structuredContent: errorData,
                                // MCP规范：错误详情在content数组中
                                content: [{
                                    type: 'text',
                                    text: `Error: ${errorMessage}`
                                }]
                            }
                        };
                    }
                } else {
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32601,
                            message: `Unknown tool: ${name}`
                        }
                    };
                }
                
                // 这一行理论上永远不会执行，但确保所有路径都有return
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32603,
                        message: 'Unexpected error in tools/call'
                    }
                };
            }

            default: {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Unknown method: ${method}`
                    }
                };
            }
        }
    } catch (error) {
        console.error('Error handling MCP request:', error);
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code: -32603,
                message: 'Internal error',
                data: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

// HTTP Streamable MCP端点 - 主要的消息处理端点
app.post('/messages', async (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
        console.log('Received MCP request:', JSON.stringify(req.body, null, 2));
    }
    
    // 验证JSON-RPC格式
    if (!req.body || req.body.jsonrpc !== '2.0') {
        return res.status(400).json({
            jsonrpc: '2.0',
            id: req.body?.id || null,
            error: {
                code: -32600,
                message: 'Invalid Request'
            }
        });
    }

    const response = await handleMcpRequest(req.body as McpRequest);
    
    if (!isProduction) {
        console.log('Sent MCP response:', JSON.stringify(response, null, 2));
    }
    
    // 发送标准HTTP JSON响应
    return res.json(response);
});

// 健康检查端点
app.get('/health', (_req, res) => {
    const config = checkConfiguration();
    
    res.json({ 
        status: config.valid ? 'ok' : 'warning', 
        service: 'alioss-mcp-server',
        initialized: serverInitialized,
        tools: availableTools.length,
        uploadMode: config.mode,
        configured: config.valid,
        missingConfig: config.missing.length > 0 ? config.missing : undefined
    });
});

// 处理命令行参数
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
    console.log(serverInfo.version);
    process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AliOSS MCP Server v${serverInfo.version}

Usage: alioss-mcp-server [options]

Options:
  -v, --version     Show version number
  -h, --help        Show help information
  
Environment Variables:
  PORT              Server port (default: 3004)
  UPLOAD_MODE       Upload mode: OSS or HOOK (default: OSS)
  
  OSS Mode:
    STS_ACCESS_KEY_ID      STS access key ID
    STS_ACCESS_KEY_SECRET  STS access key secret
    STS_ROLE_ARN          STS role ARN
    OSS_ENDPOINT          OSS endpoint
    OSS_BUCKET            OSS bucket name
    CDN_ENDPOINT          CDN endpoint
  
  HOOK Mode:
    UPLOAD_HOOK_URL       Hook upload URL

For more information, visit: https://github.com/yourusername/alioss-mcp-server
`);
    process.exit(0);
}

// 启动服务器
const PORT = parseInt(process.env.PORT || '3004');

app.listen(PORT, () => {
    console.log(`🚀 AliOSS MCP Server v${serverInfo.version} listening on port ${PORT}`);
    console.log(`✅ MCP Endpoint: http://localhost:${PORT}/messages`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`📖 Protocol: MCP 2024-11-05 (JSON-RPC 2.0 via HTTP Streamable)`);
}); 