
'use strict';
define(
    [
      'ojs/ojcore', 'knockout', 'jquery', 'ojs/ojdiagram', 'ojs/ojmenu',
      'ojs/ojjsondiagramdatasource', 'ojs/ojbutton', 'ojs/ojpopup',
      'ojs/ojlabel', 'ojs/ojinputtext'
    ],
    function(oj, ko, $) {
      const colorHandler = new oj.ColorAttributeGroupHandler();
      var httpHandler = {
        fetchAll: (nodes, links) => {
          var i = 0;
          $.getJSON('http://localhost:3000/getAll', function(data) {
            $.each(data, function() {
              nodes.push({
                id: this._id,
                label: this.name + ': ' + this.code,
                icon: {color: colorHandler.getValue('Group ' + this._id)}
              });
              links.push(
                  {id: 'L' + i++, startNode: this.parent, endNode: this._id});
              console.log(this._id);
            });
          })
        },
        update: (node, cb) => {
          $.post('http://localhost:3000/update', node, function(data) {
            cb(data, status);
          });
        },
        remove: (node, cb) => {
          $.post('http://localhost:3000/delete', node, function(data) {
            cb(data);
          });
        },
        insert: (node, cb) => {
          $.post('http://localhost:3000/insert', node, function(data) {
            cb(data);
          });
        },


      };

      function mainContentViewModel() {
        const self = this;
        self.layoutFunc = treeLayout;
        self.nodes = ko.observableArray([]);
        self.links = ko.observableArray([]);
        self.data = ko.pureComputed(function() {
          return new oj.JsonDiagramDataSource(
              {'nodes': self.nodes(), 'links': self.links()});
        });
        self.modalText = ko.observable('Edit Objective Info');
        self.newName = ko.observable('');
        self.newCode = ko.observable('');
        self.op1Disabled = ko.observable(false);
        self.op2Disabled = ko.observable(false);
        self.op3Disabled = ko.observable(false);


        httpHandler.fetchAll(self.nodes, self.links);

        // Style the nodes and links
        self.styleDefaults = {
          nodeDefaults: {icon: {width: 70, height: 70, shape: 'square'}},
          linkDefaults:
              {startConnectorType: 'none', endConnectorType: 'arrow'}
        };


        // context menu bindings
        var node, link;
        self.selectedMenuItem = ko.observable('(None selected yet)');

        self.beforeOpenFunction = function(event) {
          var target = event.detail.originalEvent.target;
          var diagram = document.getElementById('diagram');
          var context = diagram.getContextByNode(target);
          node = null, link = null;
          if (context != null) {
            if (context.subId == 'oj-diagram-node')
              node = diagram.getNode(context['index']);
            else if (context.subId == 'oj-diagram-link')
              link = diagram.getLink(context['index']);
          }
          if (node) {
            self.op2Disabled(false);
            self.op3Disabled(false);
          } else {
            self.op2Disabled(true);
            self.op3Disabled(true);
          }
        };

        var selectedAction;
        self.menuItemAction = function(event) {
          var text = event.target.value;
          console.log(text);
          selectedAction = text;

          if (node) {
            if (text == 'action3') {
              // edit node: name and code
              self.selectedMenuItem(text + ' from Node ' + node.id);
              const nc = node.label.split(': ');
              self.newName(nc[0]);
              self.newCode(nc[1]);
              var popup = document.querySelector('#popup1');
              popup.open('#btnGo')
            } else if (text == 'action2') {
              // remove node
              let newNode = {id: node.id};
              httpHandler.remove(newNode, (data) => {
                if (data.result.ok == 1 && data.result.n == 1) {
                  for (let i = 0; i < self.nodes().length; i++) {
                    if (node.id == self.nodes()[i].id) self.nodes.splice(i, 1);
                  }
                  for (let i = 0; i < self.links().length; i++) {
                    if (node.id == self.links()[i].startNode ||
                        node.id == self.links()[i].endNode) {
                      self.links.splice(i, 1);
                      i--;
                    }
                  }
                }
              });

            } else if (text == 'action1') {
              // insert new node
              self.newName('');
              self.newCode('');
              self.modalText('Create New Objective');
              var popup = document.querySelector('#popup1');
              popup.open('#btnGo')
            }
          } else if (link) {
          } else if (text == 'action1') {
            // insert new node
            self.newName('');
            self.newCode('');
            self.modalText('Create New Objective');
            var popup = document.querySelector('#popup1');
            popup.open('#btnGo')
          }
        };

        self.viewModel = {
          startAnimationListener: function(data, event) {
            var ui = event.detail;
            if (!$(event.target).is('#popup1')) return;
            if ('open' === ui.action) {
              event.preventDefault();
              var options = {'direction': 'top'};
              oj.AnimationUtils.slideIn(ui.element, options)
                  .then(ui.endCallback);
            } else if ('close' === ui.action) {
              event.preventDefault();
              ui.endCallback();
            }
          },
          cancel: function() {
            var popup = document.querySelector('#popup1');
            popup.close();
          },
          apply: function() {
            if (selectedAction == 'action3') {
              // apply the edit node code or name
              const newNode = {
                id: node.id,
                name: self.newName(),
                code: self.newCode()
              };
              httpHandler.update(newNode, (data) => {
                if (data.result.ok == 1) {
                  node.label = self.newName() + ': ' + self.newCode();
                  for (let i = 0; i < self.nodes().length; i++) {
                    if (node.id == self.nodes()[i].id)
                      self.nodes.replace(self.nodes()[i], node);
                  }
                  var popup = document.querySelector('#popup1');
                  popup.close();
                }
              });

            } else if (selectedAction == 'action1') {
              // create new node by using the new Name and new Code from the
              // text boxes
              const newNode = {
                name: self.newName(),
                code: self.newCode(),
                parent: node ?node.id:'none'
              };
              httpHandler.insert(newNode, (data) => {
                let Nid = data.result.insertedIds[0];
                if (data.result.insertedCount == 1) {
                  self.nodes.push({
                    id: Nid,
                    label: newNode.name + ': ' + newNode.code,
                    icon: {color: colorHandler.getValue('Group ' + Nid)}
                  });
                  self.links.push({
                    id: 'L' + self.links().length,
                    startNode: newNode.parent,
                    endNode: Nid
                  });
                  var popup = document.querySelector('#popup1');
                  popup.close();
                }
              });
            }
          }
        };
      }


      function treeLayout(layoutContext) {
        // Get the node and link counts from the layout context
        var nodeCount = layoutContext.getNodeCount();
        var linkCount = layoutContext.getLinkCount();

        // Create a child-parent map based on the links
        var childParentMap = {};
        for (var i = 0; i < linkCount; i++) {
          var link = layoutContext.getLinkByIndex(i);
          var parentId = link.getStartId();
          var childId = link.getEndId();

          childParentMap[childId] = parentId;
        }
        var parentChildMap = {};
        var maxNodeWidth = 0;
        var maxNodeHeight = 0;

        // Loop though the nodes to create a parent-child map
        // and to find the largest node width and height
        for (var i = 0; i < nodeCount; i++) {
          var node = layoutContext.getNodeByIndex(i);

          var nodeId = node.getId();
          var parentId = childParentMap[nodeId];

          // Keep track of the largest node width and height, for layout
          // purposes
          var nodeBounds = node.getContentBounds();
          maxNodeWidth = Math.max(nodeBounds.w, maxNodeWidth);
          maxNodeHeight = Math.max(nodeBounds.h, maxNodeHeight);

          // Add this node id to the parent-child map for that parent
          // The root nodes (i.e. nodes with no parent) will appear under the
          // key undefined in the parent-child map
          var children = parentChildMap[parentId];
          if (!children) {
            children = [];
            parentChildMap[parentId] = children;
          }
          children.push(nodeId);
        }
        // For horizontal layout, calculate the level width based on the widest
        // node in this level and calculate space for each node based on the
        // tallest node
        var levelSize = maxNodeHeight * 1.5;
        var siblingSize = maxNodeWidth * 1.1;

        // Layout the nodes
        layoutSubTree(
            layoutContext, undefined, parentChildMap, childParentMap, levelSize,
            siblingSize, -1, [0]);

        // Layout the links
        for (var i = 0; i < linkCount; i++) {
          var link = layoutContext.getLinkByIndex(i);
          var parentNode = layoutContext.getNodeById(link.getStartId());
          var childNode = layoutContext.getNodeById(link.getEndId());
          var parentNodePos = parentNode.getPosition();
          var parentNodeBounds = parentNode.getContentBounds();
          var childNodePos = childNode.getPosition();
          var childNodeBounds = childNode.getContentBounds();

          // Draw horizontal link between center of parent right edge and center
          // of child left edge
          var startX =
              parentNodePos.x + parentNodeBounds.x + parentNodeBounds.w * .5
          var startY = parentNodePos.y + parentNodeBounds.y +
              parentNodeBounds.h + link.getStartConnectorOffset();
          ;
          var endX =
              childNodePos.x + childNodeBounds.x + childNodeBounds.w * .5;
          var endY =
              childNodePos.y + childNodeBounds.y - link.getEndConnectorOffset();

          // Set the start, end and the middle points on the link
          link.setPoints([
            startX, startY, startX, (startY + endY) * 0.5, endX,
            (startY + endY) * 0.5, endX, endY
          ]);
        }
      };

      function layoutSubTree(
          layoutContext, rootId, parentChildMap, childParentMap, levelSize,
          siblingSize, currentDepth, leafPos) {
        var currentPos = leafPos[0];
        var childNodes = parentChildMap[rootId];

        // If this is a root node for other child nodes, then layout the child
        // nodes
        if (childNodes) {
          currentPos = 0;
          for (var i = 0; i < childNodes.length; i++) {
            // Layout the child subtrees recursively
            var childPosition = layoutSubTree(
                layoutContext, childNodes[i], parentChildMap, childParentMap,
                levelSize, siblingSize, currentDepth + 1, leafPos);

            // Center parent node vertically next to the children
            currentPos += childPosition.x / childNodes.length;
          }
        } else {
          // Leaf node, advance the current leaf position
          leafPos[0] += siblingSize;
        }

        var position = {x: currentPos, y: currentDepth * levelSize};

        if (rootId) {
          var root = layoutContext.getNodeById(rootId);
          if (root) {
            var bounds = root.getContentBounds();
            var rootPos = {
              x: position.x,
              y: position.y - bounds.y - bounds.h * .5
            };
            root.setPosition(rootPos);

            // Center the label inside the node
            var nodeLabelBounds = root.getLabelBounds();
            if (nodeLabelBounds) {
              var labelX =
                  bounds.x + rootPos.x + 0.5 * (bounds.w - nodeLabelBounds.w);
              var labelY =
                  bounds.y + rootPos.y + 0.5 * (bounds.h - nodeLabelBounds.h);
              root.setLabelPosition({'x': labelX, 'y': labelY});
            }
          }
        }
        return position;
      };


      return new mainContentViewModel();
    });