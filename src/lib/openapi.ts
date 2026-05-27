import { JsonObject } from 'swagger-ui-express';

const spec: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: 'Pomoblock Backend',
    version: '1.0.0',
    description: 'iOS in-app update enforcement + App Store Connect webhook handler',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      AdminBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Value of ADMIN_SECRET env var',
      },
    },
    schemas: {
      VersionConfig: {
        type: 'object',
        properties: {
          ios_current_version: { type: 'string', example: '1.0.2' },
          ios_min_version:     { type: 'string', example: '1.0.0' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    ts:     { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/webhook/apple': {
      post: {
        summary: 'Apple App Store Connect webhook',
        description: 'Receives signed events from Apple. Verifies HMAC-SHA256 signature before processing.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': { description: 'Always returned immediately to prevent Apple retries' },
        },
      },
    },

    '/config': {
      get: {
        summary: 'iOS update check',
        description: 'Called by the iOS app on launch to determine whether an update is required.',
        parameters: [
          {
            name: 'version',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            example: '1.0.1',
            description: 'The running app version (CFBundleShortVersionString)',
          },
        ],
        responses: {
          '200': {
            description: 'Update status for the given version',
            headers: {
              'Cache-Control': {
                schema: { type: 'string', example: 'public, max-age=60, stale-while-revalidate=30' },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    update_required: {
                      type: 'string',
                      enum: ['force', 'flexible', 'none'],
                    },
                    ios_current_version: { type: 'string', example: '1.0.2' },
                    ios_min_version:     { type: 'string', example: '1.0.0' },
                  },
                },
                examples: {
                  force:    { value: { update_required: 'force',    ios_current_version: '1.0.2', ios_min_version: '1.0.0' } },
                  flexible: { value: { update_required: 'flexible', ios_current_version: '1.0.2', ios_min_version: '1.0.0' } },
                  none:     { value: { update_required: 'none',     ios_current_version: '1.0.2', ios_min_version: '1.0.0' } },
                },
              },
            },
          },
          '400': { description: 'Missing version query param' },
        },
      },
    },

    '/admin/set-min-version': {
      post: {
        summary: 'Set minimum supported iOS version',
        description: 'Clients below this version will receive `update_required: force`. Only set this when a release introduces a breaking change.',
        security: [{ AdminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['version'],
                properties: {
                  version: { type: 'string', example: '1.0.0' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Min version updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ios_min_version: { type: 'string', example: '1.0.0' } },
                },
              },
            },
          },
          '400': { description: 'Invalid or missing version' },
          '401': { description: 'Unauthorized' },
        },
      },
    },

    '/admin/version-status': {
      get: {
        summary: 'Current version config',
        description: 'Returns both `ios_current_version` (set by webhook) and `ios_min_version` (set manually).',
        security: [{ AdminBearer: [] }],
        responses: {
          '200': {
            description: 'Current version config from Firestore',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/VersionConfig' },
              },
            },
          },
          '401': { description: 'Unauthorized' },
        },
      },
    },
  },
};

export default spec;
