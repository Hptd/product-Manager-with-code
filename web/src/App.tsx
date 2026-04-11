import { useState, useEffect } from 'react';
import { FileTree } from './components/FileTree';
import { RenderFrame } from './components/RenderFrame';
import { Terminal } from './components/Terminal';
import { ModeSelector, UISelectorDisplay } from './components/UISelectorComponents';
import { type UISelectorInfo, type UIIntent } from './components/UISelector';
import { api, type Project } from './api/client';
import { copyIntentToClipboard } from './components/UISelectorComponents';
import './components/UISelector.css';
import './App.css';

type LeftPanelTab = 'files' | 'ui' | 'terminal';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('project-1');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [lastIntent, setLastIntent] = useState<UIIntent | null>(null);
  const [lastElementInfo, setLastElementInfo] = useState<UISelectorInfo | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>('files');

  // 加载项目列表
  useEffect(() => {
    loadProjects();
  }, []);

  // 当项目列表为空时，自动打开创建项目对话框
  useEffect(() => {
    if (projects.length === 0 && !showNewProjectModal) {
      setShowNewProjectModal(true);
    }
  }, [projects]);

  const loadProjects = async () => {
    const data = await api.getProjects();
    setProjects(data);
    if (data.length > 0 && !selectedProject) {
      setSelectedProject(data[0].name);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('请输入项目名称');
      return;
    }

    try {
      await api.createProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProjectModal(false);
      await loadProjects();
      setSelectedProject(newProjectName.trim());
    } catch (error: any) {
      alert(error.response?.data?.error || '创建项目失败');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`确定要删除项目 "${selectedProject}" 吗？此操作不可撤销！`)) {
      return;
    }

    try {
      const projectToDelete = selectedProject;
      // 先找到要切换到的项目（如果有其他项目）
      const nextProject = projects.find(p => p.name !== projectToDelete);

      await api.deleteProject(projectToDelete);
      await loadProjects();
      // 切换到其他项目，或清空选择（引导用户创建新项目）
      setSelectedProject(nextProject?.name || '');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || '删除项目失败';
      alert(`删除项目失败：${errorMsg}`);
    }
  };

  const handleSelectFile = async (path: string) => {
    setSelectedPath(path);

    // 只加载 HTML 文件内容
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      try {
        const content = await api.getFileContent(selectedProject, path);
        setFileContent(content);
      } catch (error) {
        console.error('加载文件失败:', error);
        setFileContent('');
      }
    } else {
      setFileContent('');
    }
  };

  const handleFileChange = async (path: string) => {
    // 热更新触发时重新加载文件内容
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      try {
        const content = await api.getFileContent(selectedProject, path);
        setFileContent(content);
      } catch (error) {
        console.error('重新加载文件失败:', error);
      }
    }
  };

  const handleElementSelect = (info: UISelectorInfo) => {
    console.log('🎯 元素选择:', info);
    setLastElementInfo(info);
  };

  const handleIntentGenerate = (intent: UIIntent) => {
    console.log('🔄 生成 Intent:', intent);
    setLastIntent(intent);
  };

  const handleCopyIntent = async () => {
    if (lastIntent) {
      const success = await copyIntentToClipboard(lastIntent);
      if (success) {
        alert('✅ Intent 已复制到剪贴板');
      } else {
        alert('❌ 复制失败，请手动复制');
      }
    }
  };

  return (
    <div className="app">
      {/* 顶部容器 - 左侧面板 + 右侧渲染区 */}
      <div className="panel-top-container">
        {/* 左侧面板 - 带选项卡切换 */}
        <div className="panel-left-container">
          {/* 侧边栏选项卡 */}
          <div className="sidebar-tabs">
            <button
              className={`tab-btn ${leftPanelTab === 'files' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('files')}
              title="文件管理"
            >
              📁
            </button>
            <button
              className={`tab-btn ${leftPanelTab === 'ui' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('ui')}
              title="UI 选择系统"
            >
              🎯
            </button>
            <button
              className={`tab-btn ${leftPanelTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('terminal')}
              title="终端"
            >
              💻
            </button>
          </div>

          {/* 左侧内容区 */}
          <div className="panel-left-content">
            {/* 文件管理面板 */}
            <div className={`panel-section ${leftPanelTab === 'files' ? 'active' : ''}`}>
              <div className="panel-file-manager-full">
                {projects.length === 0 ? (
                  <div className="empty-project-state">
                    <div className="empty-icon">📁</div>
                    <h3>暂无项目</h3>
                    <p>请先创建一个新项目以开始使用</p>
                    <button className="btn-create-project-primary" onClick={() => setShowNewProjectModal(true)}>
                      ➕ 创建新项目
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="project-selector">
                      <label>项目:</label>
                      <select
                        value={selectedProject}
                        onChange={(e) => {
                          setSelectedProject(e.target.value);
                          setSelectedPath('');
                          setFileContent('');
                        }}
                      >
                        {projects.map((project) => (
                          <option key={project.name} value={project.name}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn-new-project" onClick={() => setShowNewProjectModal(true)} title="新建项目">
                        ➕
                      </button>
                      <button className="btn-delete-project" onClick={handleDeleteProject} title="删除当前项目">
                        🗑️
                      </button>
                    </div>
                    <FileTree
                      projectName={selectedProject}
                      onSelectFile={handleSelectFile}
                      selectedPath={selectedPath}
                    />
                  </>
                )}
              </div>
            </div>

            {/* UI 选择系统面板 */}
            <div className={`panel-section ${leftPanelTab === 'ui' ? 'active' : ''}`}>
              <div className="panel-ui-selector-full">
                <div className="panel-header">
                  <h3>🎯 页面 UI 选择系统</h3>
                  <span className="panel-subtitle">基于 ai-ui-runtime 设计理念 | 选择·移动·缩放·描述</span>
                </div>
                <UISelectorDisplay
                  info={lastElementInfo}
                  intent={lastIntent}
                  onCopyIntent={handleCopyIntent}
                />
              </div>
            </div>

            {/* 终端面板 */}
            <div className={`panel-section ${leftPanelTab === 'terminal' ? 'active' : ''}`}>
              <div className="panel-terminal-full">
                <Terminal cwd={`F:\\js-vue-project\\productManager\\axure\\projects\\${selectedProject}`} />
              </div>
            </div>
          </div>
        </div>

        {/* 右侧容器 - 渲染区 */}
        <div className="panel-right-container">
          {/* 核心渲染区域 */}
          <div className="panel-render">
            <RenderFrame
              filePath={selectedPath}
              fileContent={fileContent}
              onFileChange={handleFileChange}
              onElementSelect={handleElementSelect}
              onIntentGenerate={handleIntentGenerate}
            />
          </div>
        </div>
      </div>

      {/* 新建项目模态框 */}
      {showNewProjectModal && (
        <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>新建项目</h3>
            <div className="modal-body">
              <label>项目名称:</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="输入项目名称..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowNewProjectModal(false)}>
                取消
              </button>
              <button className="btn-confirm" onClick={handleCreateProject}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
