import {
  React,
  PropTypes,
  View,
  componentFactory
}                             from '@base';
import styleSheet             from './base-page-styles';
import { registerPage }       from '@base/utils';

const BasePage = componentFactory('BasePage', ({ Parent, componentName }) => {
  return class BasePage extends Parent {
    static styleSheet = styleSheet;

    static propTypes = {
      pageRootStyle: PropTypes.any,
      pageContentContainerStyle: PropTypes.any,
    };

    static _componentFactoryHook(ComponentClass, ReactComponentClass) {
      var pageName = ComponentClass.displayName;
      if (pageName === 'BasePage' || !ComponentClass.pageInfo)
        return { ComponentClass, ReactComponentClass };

      var getPageInfo = ComponentClass.pageInfo,
          pageID = `Page:${pageName}`;

      registerPage(pageName, function() {
        var pageInfo = getPageInfo.call(this);

        return Object.assign({
          id: pageID,
          key: pageID,
          createPageComponent: (props) => {
            return (<ReactComponentClass {...props}/>);
          }
        }, pageInfo);
      });

      return {
        ComponentClass,
        ReactComponentClass
      };
    }

    construct() {
      global.currentPage = this;
    }

    //###if(MOBILE) {###//
    renderPlatformView(contexts) {
      // mobile render (for future)
    }
    //###} else {###//
    renderPlatformView(children) {
      return (
        <View className={this.getRootClassName(componentName)} style={this.style('container', this.props.pageRootStyle)}>
          <View className={this.getRootClassName(componentName, 'pageContentContainer')} style={this.style('pageContentContainer', this.props.pageContentContainerStyle)}>
            {this.getChildren(children)}
          </View>
        </View>
      );
    }
    //###}###//

    render(children) {
      return this.renderPlatformView(children);
    }
  };
});

export { BasePage };
