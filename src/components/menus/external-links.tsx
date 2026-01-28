import {faDiscord, faGithub} from '@fortawesome/free-brands-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import {VIALogo} from '../icons/via';
import {KBTESTLogo} from '../icons/kbtest';
import {CategoryMenuTooltip} from '../inputs/tooltip';
import {CategoryIconContainer} from '../panes/grid';
import {useTranslation} from 'react-i18next'; // 1. 确保导入了钩子

const ExternalLinkContainer = styled.span`
  position: relative;
  right: 0em;
  display: flex;
  gap: 1em;
`;

export const ExternalLinks = () => {
  // 2. 在组件内部初始化 t 函数
  const { t } = useTranslation();

  return (
    <ExternalLinkContainer>
      <a href="https://lhfha.x3322.net:8183/kbtest.html" target="_blank">
        <CategoryIconContainer>
          <KBTESTLogo height="25px" fill="currentColor" />
          {/* 3. 使用 {t('key')} 包裹文本 */}
          <CategoryMenuTooltip>{t('kbtest')}</CategoryMenuTooltip>
        </CategoryIconContainer>
      </a>

      <a href="https://www.kdocs.cn/l/ccEMhzCJ3L9q" target="_blank">
        <CategoryIconContainer>
          <VIALogo height="25px" fill="currentColor" />
          {/* 3. 使用 {t('key')} 包裹文本 */}
          <CategoryMenuTooltip>{t('Apply for support')}</CategoryMenuTooltip>
        </CategoryIconContainer>
      </a>

      <a href="https://github.com/qmk/qmk_firmware" target="_blank">
        <CategoryIconContainer>
          <FontAwesomeIcon size={'xl'} icon={faGithub} />
          <CategoryMenuTooltip>{t('QMK')}</CategoryMenuTooltip>
        </CategoryIconContainer>
      </a>
    </ExternalLinkContainer>
  );
};