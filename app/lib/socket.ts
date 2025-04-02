import { Server } from "socket.io";

interface SocketContext {
  io: Server;
  userId: string;
}

export async function emitProjectUpdate(context: SocketContext, updatedProject: any) {
  console.log('[emitProjectUpdate] Starting with:', {
    hasContext: !!context,
    hasIo: !!context?.io,
    projectId: updatedProject?.id,
    userId: updatedProject?.userId
  });

  if (context?.io && updatedProject) {
    const userId = updatedProject.userId;
    console.log('[emitProjectUpdate] Emitting to user:', userId);
    
    try {
      context.io.to(userId).emit('project:update', {
        projectId: updatedProject.id,
        project: updatedProject,
      });
      console.log('[emitProjectUpdate] Successfully emitted project update');
    } catch (error) {
      console.error('[emitProjectUpdate] Error emitting project update:', error);
      throw error;
    }
  } else {
    console.warn('[emitProjectUpdate] Skipping emit - missing required data:', {
      hasContext: !!context,
      hasIo: !!context?.io,
      hasProject: !!updatedProject
    });
  }
} 