import { handleMediaRequest, type MediaEnv } from './handler.ts'

const worker = {
  fetch(request: Request, env: MediaEnv): Promise<Response> {
    return handleMediaRequest(request, env)
  },
}

export default worker
